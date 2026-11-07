import os
import time
import json
import uuid
import logging
import docker
import requests

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:8000")
DOCKER_NETWORK = os.getenv("DOCKER_NETWORK", "distributed-bank_default")
STATE_FILE_PATH = os.getenv("STATE_FILE_PATH", "/data/controller_state.json")
CHECK_INTERVAL_SECONDS = 3

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [Self-Healing] %(message)s")
logger = logging.getLogger("SelfHealingController")

SHARD_SPECS = {
    "Shard-A": {
        "required_count": 2,
        "db_host": "db-shard-a",
        "db_port": 5432,
        "db_name": "bank_shard_a",
        "db_user": "postgres",
        "db_password": "password",
        "image_tag": "distributed-bank-bank-server-a1:latest"
    },
    "Shard-B": {
        "required_count": 2,
        "db_host": "db-shard-b",
        "db_port": 5432,
        "db_name": "bank_shard_b",
        "db_user": "postgres",
        "db_password": "password",
        "image_tag": "distributed-bank-bank-server-b1:latest"
    }
}

client = docker.from_env()

def load_persisted_state() -> dict:
    if os.path.exists(STATE_FILE_PATH):
        try:
            with open(STATE_FILE_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load state file: {str(e)}")
    return {"managed_replicas": {}}

def save_persisted_state(state: dict):
    try:
        os.makedirs(os.path.dirname(STATE_FILE_PATH), exist_ok=True)
        with open(STATE_FILE_PATH, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to persist state: {str(e)}")

def is_container_healthy(container_name: str) -> bool:
    try:
        container = client.containers.get(container_name)
        if container.status != "running":
            return False
        # Verify via health endpoint over internal container network
        res = requests.get(f"http://{container_name}:8000/health", timeout=1.5)
        return res.status_code == 200
    except Exception:
        return False

def register_with_gateway(shard_id: str, replica_url: str):
    try:
        requests.post(
            f"{GATEWAY_URL}/replicas/register",
            json={"shard_id": shard_id, "replica_url": replica_url},
            timeout=2.0
        )
        logger.info(f"Registered {replica_url} with Gateway for {shard_id}")
    except Exception as e:
        logger.warning(f"Failed to register {replica_url} with Gateway: {str(e)}")

def spawn_replacement_replica(shard_id: str) -> str:
    spec = SHARD_SPECS[shard_id]
    unique_suffix = uuid.uuid4().hex[:6]
    container_name = f"bank-server-{shard_id.lower()}-auto-{unique_suffix}"
    replica_name = f"AutoServer-{shard_id}-{unique_suffix}"

    logger.info(f"Spawning replacement container {container_name} for {shard_id}...")

    env = {
        "REPLICA_NAME": replica_name,
        "SHARD_NAME": shard_id,
        "DB_HOST": spec["db_host"],
        "DB_PORT": spec["db_port"],
        "DB_NAME": spec["db_name"],
        "DB_USER": spec["db_user"],
        "DB_PASSWORD": spec["db_password"]
    }

    container = client.containers.run(
        image=spec["image_tag"],
        name=container_name,
        detach=True,
        environment=env,
        network=DOCKER_NETWORK,
        labels={
            "com.docker.compose.project": "distributed-bank",
            "managed_by": "self-healing-controller",
            "shard": shard_id
        }
    )

    replica_internal_url = f"http://{container_name}:8000"

    # Wait for the replica process to become healthy
    time.sleep(2)
    register_with_gateway(shard_id, replica_internal_url)
    return container_name

def reconcile():
    state = load_persisted_state()
    managed = state.setdefault("managed_replicas", {})

    for shard_id, spec in SHARD_SPECS.items():
        current_containers = managed.setdefault(shard_id, [])

        # Filter out stopped or dead replicas
        active_containers = []
        for c_name in current_containers:
            if is_container_healthy(c_name):
                active_containers.append(c_name)
            else:
                logger.warning(f"Replica container {c_name} in {shard_id} is dead or unresponsive. Cleaning up...")
                try:
                    c = client.containers.get(c_name)
                    c.remove(force=True)
                except Exception:
                    pass

        # Re-include baseline static containers from compose if they are healthy
        try:
            baseline_labels = {"Shard-A": ["bank-server-a1", "bank-server-a2"], "Shard-B": ["bank-server-b1", "bank-server-b2"]}
            for b_name in baseline_labels[shard_id]:
                if b_name not in active_containers and is_container_healthy(b_name):
                    active_containers.append(b_name)
        except Exception:
            pass

        # Maintain exact target count
        needed = spec["required_count"] - len(active_containers)
        if needed > 0:
            logger.info(f"{shard_id} has {len(active_containers)} healthy replicas. Target: {spec['required_count']}. Spawning {needed} new replica(s)...")
            for _ in range(needed):
                new_c_name = spawn_replacement_replica(shard_id)
                active_containers.append(new_c_name)

        managed[shard_id] = active_containers

    save_persisted_state(state)

def run_controller():
    logger.info("Autonomous Self-Healing Controller initialized.")
    while True:
        try:
            reconcile()
        except Exception as e:
            logger.error(f"Error during reconciliation cycle: {str(e)}")
        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    run_controller()