import time
import subprocess
import concurrent.futures
import requests

GATEWAY_URL = "http://localhost:8080"

def run_cmd(cmd: list):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def test_self_healing():
    print_header("BONUS II: Autonomous Self-Healing Verification")

    # 1. Verify healthy baseline
    health = requests.get(f"{GATEWAY_URL}/health").json()
    print("Initial Healthy Replicas:", health["healthy_replicas"])
    assert len(health["healthy_replicas"]["Shard-A"]) >= 2, "Shard-A below target baseline"

    # 2. Crash a replica while concurrent traffic is running
    print("\n[Step 1] Injecting failure: Terminating bank-server-a1 while processing concurrent requests...")

    def send_deposit():
        try:
            requests.post(f"{GATEWAY_URL}/accounts/A0015/deposit", json={"amount": 5.0}, timeout=2.0)
        except Exception:
            pass

    # Launch background traffic
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    futures = [executor.submit(send_deposit) for _ in range(15)]

    # Kill replica immediately
    run_cmd(["docker", "stop", "bank-server-a1"])
    run_cmd(["docker", "rm", "bank-server-a1"])
    concurrent.futures.wait(futures)
    executor.shutdown()

    print("Replica bank-server-a1 abruptly stopped and removed.")
    print("Waiting for Self-Healing Controller to detect and spawn replacement (up to 10s)...")

    replacement_detected = False
    for _ in range(10):
        time.sleep(1.5)
        h = requests.get(f"{GATEWAY_URL}/health").json()
        shard_a_reps = h["healthy_replicas"]["Shard-A"]
        # Check if an auto-spawned replica has registered
        if any("auto" in rep for rep in shard_a_reps):
            print(f"Detected newly spawned replacement replica in Gateway: {shard_a_reps}")
            replacement_detected = True
            break

    assert replacement_detected, "Self-Healing Controller failed to create replacement replica"

    # 3. Test Controller Crash and Restart (Duplicate replica prevention)
    print("\n[Step 2] Testing Controller Crash & Recovery (No duplicate replicas)...")
    run_cmd(["docker", "stop", "self-healing-controller"])
    print("Self-Healing Controller stopped abruptly.")
    time.sleep(2)
    run_cmd(["docker", "start", "self-healing-controller"])
    print("Self-Healing Controller restarted. Reconciling state...")
    time.sleep(4)

    h_after = requests.get(f"{GATEWAY_URL}/health").json()
    shard_a_count = len(h_after["healthy_replicas"]["Shard-A"])
    print(f"Active Shard-A Replicas after controller restart: {shard_a_count}")
    assert shard_a_count == 2, f"Expected exactly 2 replicas, found {shard_a_count} (Duplicates detected!)"

    print("\n>> BONUS II PASSED: Autonomous Self-Healing fully satisfied without Kubernetes or restart policies.")

if __name__ == "__main__":
    test_self_healing()