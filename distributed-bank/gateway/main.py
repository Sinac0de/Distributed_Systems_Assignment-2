import os
import json
import asyncio
import logging
from decimal import Decimal
from typing import Dict, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
import httpx

SHARD_MAP_PATH = os.getenv("SHARD_MAP_PATH", "shard_map.json")
COORDINATOR_URL = os.getenv("COORDINATOR_URL", "http://coordinator:8000")

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [Gateway] %(message)s")
logger = logging.getLogger("Gateway")

# Load shard mapping configuration
with open(SHARD_MAP_PATH, "r") as f:
    SHARD_CONFIG = json.load(f)

# Health state and round-robin index storage
healthy_replicas: Dict[str, List[str]] = {shard["id"]: [] for shard in SHARD_CONFIG["shards"]}
rr_indices: Dict[str, int] = {shard["id"]: 0 for shard in SHARD_CONFIG["shards"]}

def get_shard_by_account(account_id: str) -> dict:
    if not account_id.startswith("A"):
        raise HTTPException(status_code=400, detail=f"Invalid account format: {account_id}")
    try:
        acc_num = int(account_id[1:])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid account identifier: {account_id}")

    for shard in SHARD_CONFIG["shards"]:
        if shard["range_start"] <= acc_num <= shard["range_end"]:
            return shard
    raise HTTPException(status_code=404, detail=f"Account {account_id} not mapped to any known shard")

def select_replica_round_robin(shard_id: str) -> str:
    available = healthy_replicas.get(shard_id, [])
    if not available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No healthy replicas currently available for {shard_id}"
        )
    idx = rr_indices[shard_id] % len(available)
    selected = available[idx]
    rr_indices[shard_id] = (idx + 1) % len(available)
    return selected

async def monitor_replicas_health():
    async with httpx.AsyncClient(timeout=2.0) as client:
        while True:
            for shard in SHARD_CONFIG["shards"]:
                shard_id = shard["id"]
                current_healthy = []
                for replica_url in shard["replicas"]:
                    try:
                        res = await client.get(f"{replica_url}/health")
                        if res.status_code == 200:
                            current_healthy.append(replica_url)
                    except Exception:
                        pass
                healthy_replicas[shard_id] = current_healthy
            await asyncio.sleep(2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initial health scan
    async with httpx.AsyncClient(timeout=2.0) as client:
        for shard in SHARD_CONFIG["shards"]:
            shard_id = shard["id"]
            for replica_url in shard["replicas"]:
                try:
                    res = await client.get(f"{replica_url}/health")
                    if res.status_code == 200:
                        healthy_replicas[shard_id].append(replica_url)
                except Exception:
                    pass
    task = asyncio.create_task(monitor_replicas_health())
    yield
    task.cancel()

app = FastAPI(title="Banking Platform Shard-Aware Gateway", lifespan=lifespan)

class AmountPayload(BaseModel):
    amount: Decimal

class TransferPayload(BaseModel):
    source_acc: str
    target_acc: str
    amount: Decimal

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "gateway",
        "healthy_replicas": healthy_replicas
    }

@app.get("/accounts/{account_id}/balance")
async def get_balance(account_id: str):
    shard = get_shard_by_account(account_id)
    replica_url = select_replica_round_robin(shard["id"])
    logger.info(f"Routing balance request for {account_id} -> {shard['id']} via {replica_url}")

    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            res = await client.get(f"{replica_url}/accounts/{account_id}/balance")
            return res.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Replica communication failed: {str(e)}")

@app.post("/accounts/{account_id}/deposit")
async def deposit(account_id: str, payload: AmountPayload):
    shard = get_shard_by_account(account_id)
    replica_url = select_replica_round_robin(shard["id"])
    logger.info(f"Routing deposit for {account_id} -> {shard['id']} via {replica_url}")

    async with httpx.AsyncClient(timeout=3.0) as client:
        res = await client.post(
            f"{replica_url}/accounts/{account_id}/deposit",
            json={"amount": float(payload.amount)}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.json().get("detail", "Deposit failed"))
        return res.json()

@app.post("/accounts/{account_id}/withdraw")
async def withdraw(account_id: str, payload: AmountPayload):
    shard = get_shard_by_account(account_id)
    replica_url = select_replica_round_robin(shard["id"])
    logger.info(f"Routing withdrawal for {account_id} -> {shard['id']} via {replica_url}")

    async with httpx.AsyncClient(timeout=3.0) as client:
        res = await client.post(
            f"{replica_url}/accounts/{account_id}/withdraw",
            json={"amount": float(payload.amount)}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.json().get("detail", "Withdrawal failed"))
        return res.json()

@app.post("/transfer")
async def transfer(payload: TransferPayload):
    src_shard = get_shard_by_account(payload.source_acc)
    tgt_shard = get_shard_by_account(payload.target_acc)

    # Route based on shard boundaries
    if src_shard["id"] == tgt_shard["id"]:
        replica_url = select_replica_round_robin(src_shard["id"])
        logger.info(f"Executing same-shard transfer via {src_shard['id']} replica: {replica_url}")

        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                f"{replica_url}/transfer/local",
                json={
                    "source_acc": payload.source_acc,
                    "target_acc": payload.target_acc,
                    "amount": float(payload.amount)
                }
            )
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.json().get("detail", "Local transfer failed"))
            return res.json()
    else:
        logger.info(f"Executing cross-shard transfer ({src_shard['id']} -> {tgt_shard['id']}) via Coordinator")
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                f"{COORDINATOR_URL}/transactions/execute",
                json={
                    "source_acc": payload.source_acc,
                    "target_acc": payload.target_acc,
                    "amount": float(payload.amount)
                }
            )
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.json().get("detail", "Cross-shard transfer failed"))
            return res.json()

@app.get("/transactions/{tx_id}/status")
async def get_transaction_status(tx_id: str):
    async with httpx.AsyncClient(timeout=3.0) as client:
        res = await client.get(f"{COORDINATOR_URL}/transactions/{tx_id}/status")
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="Transaction not found or query failed")
        return res.json()