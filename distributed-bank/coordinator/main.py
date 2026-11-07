import os
import uuid
import logging
from decimal import Decimal
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
import httpx

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5434"))
DB_NAME = os.getenv("DB_NAME", "coordinator_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

SHARD_A_REPLICAS = os.getenv("SHARD_A_REPLICAS", "http://bank-server-a1:8000,http://bank-server-a2:8000").split(",")
SHARD_B_REPLICAS = os.getenv("SHARD_B_REPLICAS", "http://bank-server-b1:8000,http://bank-server-b2:8000").split(",")

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [Coordinator] %(message)s")
logger = logging.getLogger("Coordinator")

def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    conn.autocommit = True
    return conn

def update_tx_state(tx_id: str, new_state: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE coordinator_tx_log SET state = %s, updated_at = CURRENT_TIMESTAMP WHERE tx_id = %s;",
                (new_state, tx_id)
            )

def get_account_shard(account_id: str) -> str:
    # A0001 - A1000 belongs to Shard A, A1001 - A2000 belongs to Shard B
    if not account_id.startswith("A"):
        raise ValueError(f"Invalid account format: {account_id}")
    num = int(account_id[1:])
    if 1 <= num <= 1000:
        return "Shard-A"
    elif 1001 <= num <= 2000:
        return "Shard-B"
    raise ValueError(f"Account {account_id} out of configured shard ranges")

def get_healthy_replica_url(shard_name: str) -> Optional[str]:
    replicas = SHARD_A_REPLICAS if shard_name == "Shard-A" else SHARD_B_REPLICAS
    with httpx.Client(timeout=2.0) as client:
        for replica in replicas:
            try:
                res = client.get(f"{replica.strip()}/health")
                if res.status_code == 200:
                    return replica.strip()
            except Exception:
                continue
    return None

def recover_pending_transactions():
    logger.info("Starting recovery check for unresolved distributed transactions...")
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT tx_id, source_acc, target_acc, amount, state FROM coordinator_tx_log WHERE state NOT IN ('COMPLETED', 'ABORTED');"
                )
                unresolved = cur.fetchall()
    except Exception as e:
        logger.error(f"Failed to query unresolved transactions during startup: {str(e)}")
        return

    if not unresolved:
        logger.info("No unresolved transactions found during startup.")
        return

    logger.warning(f"Found {len(unresolved)} unresolved transaction(s). Initiating recovery protocol.")

    with httpx.Client(timeout=5.0) as client:
        for tx_id, src_acc, tgt_acc, amt, state in unresolved:
            src_shard = get_account_shard(src_acc)
            tgt_shard = get_account_shard(tgt_acc)
            src_url = get_healthy_replica_url(src_shard)
            tgt_url = get_healthy_replica_url(tgt_shard)

            if not src_url or not tgt_url:
                logger.error(f"Cannot recover tx {tx_id}: one or more shards currently unreachable.")
                continue

            if state == "COMMIT_DECIDED":
                logger.info(f"Recovering tx {tx_id}: Retrying COMMIT on both participants...")
                try:
                    client.post(f"{src_url}/2pc/commit", json={"tx_id": tx_id})
                    client.post(f"{tgt_url}/2pc/commit", json={"tx_id": tx_id})
                    update_tx_state(tx_id, "COMPLETED")
                    logger.info(f"Tx {tx_id} successfully recovered and marked as COMPLETED.")
                except Exception as e:
                    logger.error(f"Error finalizing commit during recovery of tx {tx_id}: {str(e)}")
            else:
                logger.info(f"Recovering tx {tx_id}: Rolling back participants to safe state...")
                try:
                    client.post(f"{src_url}/2pc/abort", json={"tx_id": tx_id})
                    client.post(f"{tgt_url}/2pc/abort", json={"tx_id": tx_id})
                    update_tx_state(tx_id, "ABORTED")
                    logger.info(f"Tx {tx_id} safely rolled back and marked as ABORTED.")
                except Exception as e:
                    logger.error(f"Error aborting tx {tx_id}: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    recover_pending_transactions()
    yield

app = FastAPI(title="Distributed Transaction Coordinator", lifespan=lifespan)

class CrossShardTransferPayload(BaseModel):
    source_acc: str
    target_acc: str
    amount: Decimal
    simulate_crash_after_decision: bool = False

@app.get("/health")
def health_check():
    return {"status": "UP", "service": "coordinator"}

@app.get("/transactions/{tx_id}/status")
def get_transaction_status(tx_id: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tx_id, source_acc, target_acc, amount, state, created_at, updated_at FROM coordinator_tx_log WHERE tx_id = %s;",
                (tx_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transaction ID not found")

            state = row[4]
            # Expose pending flag if transaction is not in a terminal state
            is_pending = state not in ["COMPLETED", "ABORTED"]
            return {
                "tx_id": row[0],
                "source_acc": row[1],
                "target_acc": row[2],
                "amount": float(row[3]),
                "state": state,
                "is_pending": is_pending,
                "created_at": str(row[5]),
                "updated_at": str(row[6])
            }

@app.post("/transactions/execute")
def execute_cross_shard_transfer(payload: CrossShardTransferPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    src_shard = get_account_shard(payload.source_acc)
    tgt_shard = get_account_shard(payload.target_acc)

    if src_shard == tgt_shard:
        raise HTTPException(status_code=400, detail="Both accounts reside in the same shard; use local transfer")

    src_url = get_healthy_replica_url(src_shard)
    tgt_url = get_healthy_replica_url(tgt_shard)

    if not src_url or not tgt_url:
        raise HTTPException(status_code=503, detail="One or more target shards have no healthy replicas")

    tx_id = f"tx_{uuid.uuid4().hex[:12]}"
    logger.info(f"Initiating 2PC cross-shard transfer {tx_id} ({payload.source_acc} -> {payload.target_acc}, amount={payload.amount})")

    # Record INITIATED state durably
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO coordinator_tx_log (tx_id, source_acc, target_acc, amount, state) VALUES (%s, %s, %s, %s, 'INITIATED');",
                (tx_id, payload.source_acc, payload.target_acc, payload.amount)
            )

    update_tx_state(tx_id, "PREPARING")

    with httpx.Client(timeout=4.0) as client:
        # Phase 1: Prepare
        src_vote = "NO"
        tgt_vote = "NO"
        src_reason = "Unreachable"
        tgt_reason = "Unreachable"

        try:
            res_src = client.post(
                f"{src_url}/2pc/prepare",
                json={"tx_id": tx_id, "account_id": payload.source_acc, "amount": float(payload.amount), "action": "DEBIT"}
            )
            if res_src.status_code == 200:
                data = res_src.json()
                src_vote = data.get("vote", "NO")
                src_reason = data.get("reason", "")
        except Exception as e:
            src_reason = str(e)

        try:
            res_tgt = client.post(
                f"{tgt_url}/2pc/prepare",
                json={"tx_id": tx_id, "account_id": payload.target_acc, "amount": float(payload.amount), "action": "CREDIT"}
            )
            if res_tgt.status_code == 200:
                data = res_tgt.json()
                tgt_vote = data.get("vote", "NO")
                tgt_reason = data.get("reason", "")
        except Exception as e:
            tgt_reason = str(e)

        logger.info(f"2PC Phase 1 Votes for {tx_id}: Source Shard ({src_shard}) = {src_vote}, Target Shard ({tgt_shard}) = {tgt_vote}")

        # Phase 2: Commit or Abort
        if src_vote == "YES" and tgt_vote == "YES":
            update_tx_state(tx_id, "COMMIT_DECIDED")
            logger.info(f"Decision durably logged: COMMIT_DECIDED for {tx_id}")

            if payload.simulate_crash_after_decision:
                logger.warning(f"Simulating coordinator crash after durable COMMIT decision for tx {tx_id}...")
                os._exit(1)

            client.post(f"{src_url}/2pc/commit", json={"tx_id": tx_id})
            client.post(f"{tgt_url}/2pc/commit", json={"tx_id": tx_id})
            update_tx_state(tx_id, "COMPLETED")
            logger.info(f"Transaction {tx_id} successfully COMPLETED")

            return {
                "tx_id": tx_id,
                "status": "COMPLETED",
                "source": payload.source_acc,
                "target": payload.target_acc,
                "amount": float(payload.amount)
            }
        else:
            update_tx_state(tx_id, "ABORT_DECIDED")
            logger.warning(f"Decision durably logged: ABORT_DECIDED for {tx_id}. Reasons: src={src_reason}, tgt={tgt_reason}")

            if src_vote == "YES":
                client.post(f"{src_url}/2pc/abort", json={"tx_id": tx_id})
            if tgt_vote == "YES":
                client.post(f"{tgt_url}/2pc/abort", json={"tx_id": tx_id})

            update_tx_state(tx_id, "ABORTED")

            raise HTTPException(
                status_code=400,
                detail=f"Cross-shard transfer aborted. Source vote: {src_vote} ({src_reason}), Target vote: {tgt_vote} ({tgt_reason})"
            )