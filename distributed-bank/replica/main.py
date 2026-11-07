import os
import logging
from decimal import Decimal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from psycopg2 import sql

REPLICA_NAME = os.getenv("REPLICA_NAME", "Replica-Unknown")
SHARD_NAME = os.getenv("SHARD_NAME", "Shard-Unknown")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "bank_shard_a")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

logging.basicConfig(
    level=logging.INFO,
    format=f"[%(asctime)s] [{SHARD_NAME} | {REPLICA_NAME}] %(message)s"
)
logger = logging.getLogger(REPLICA_NAME)

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

app = FastAPI(title=f"Banking Replica - {REPLICA_NAME}")

class AmountPayload(BaseModel):
    amount: Decimal

class LocalTransferPayload(BaseModel):
    source_acc: str
    target_acc: str
    amount: Decimal

class PreparePayload(BaseModel):
    tx_id: str
    account_id: str
    amount: Decimal
    action: str

class TxDecisionPayload(BaseModel):
    tx_id: str

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "replica": REPLICA_NAME,
        "shard": SHARD_NAME
    }

@app.get("/accounts/{account_id}/balance")
def get_balance(account_id: str):
    logger.info(f"Balance check requested for account {account_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT balance FROM accounts WHERE account_id = %s;", (account_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Account not found")
            return {
                "account_id": account_id,
                "balance": float(row[0]),
                "replica": REPLICA_NAME,
                "shard": SHARD_NAME
            }
    finally:
        conn.close()

@app.post("/accounts/{account_id}/deposit")
def deposit(account_id: str, payload: AmountPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Deposit amount must be positive")

    logger.info(f"Depositing {payload.amount} to account {account_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN;")
            cur.execute("SELECT balance FROM accounts WHERE account_id = %s FOR UPDATE;", (account_id,))
            row = cur.fetchone()
            if not row:
                cur.execute("ROLLBACK;")
                raise HTTPException(status_code=404, detail="Account not found")

            cur.execute(
                "UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s RETURNING balance;",
                (payload.amount, account_id)
            )
            new_balance = cur.fetchone()[0]
            cur.execute("COMMIT;")
            return {
                "account_id": account_id,
                "new_balance": float(new_balance),
                "replica": REPLICA_NAME,
                "shard": SHARD_NAME
            }
    finally:
        conn.close()

@app.post("/accounts/{account_id}/withdraw")
def withdraw(account_id: str, payload: AmountPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be positive")

    logger.info(f"Withdrawing {payload.amount} from account {account_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN;")
            cur.execute("SELECT balance FROM accounts WHERE account_id = %s FOR UPDATE;", (account_id,))
            row = cur.fetchone()
            if not row:
                cur.execute("ROLLBACK;")
                raise HTTPException(status_code=404, detail="Account not found")

            current_balance = row[0]
            if current_balance < payload.amount:
                cur.execute("ROLLBACK;")
                raise HTTPException(status_code=400, detail="Insufficient funds")

            cur.execute(
                "UPDATE accounts SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s RETURNING balance;",
                (payload.amount, account_id)
            )
            new_balance = cur.fetchone()[0]
            cur.execute("COMMIT;")
            return {
                "account_id": account_id,
                "new_balance": float(new_balance),
                "replica": REPLICA_NAME,
                "shard": SHARD_NAME
            }
    finally:
        conn.close()

@app.post("/transfer/local")
def local_transfer(payload: LocalTransferPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be positive")
    if payload.source_acc == payload.target_acc:
        raise HTTPException(status_code=400, detail="Source and target accounts must be distinct")

    logger.info(f"Local transfer of {payload.amount} from {payload.source_acc} to {payload.target_acc}")

    first_acc, second_acc = sorted([payload.source_acc, payload.target_acc])
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN;")
            cur.execute(
                "SELECT account_id, balance FROM accounts WHERE account_id IN (%s, %s) ORDER BY account_id FOR UPDATE;",
                (first_acc, second_acc)
            )
            rows = dict(cur.fetchall())

            if payload.source_acc not in rows or payload.target_acc not in rows:
                cur.execute("ROLLBACK;")
                raise HTTPException(status_code=404, detail="One or both accounts do not exist in this shard")

            if rows[payload.source_acc] < payload.amount:
                cur.execute("ROLLBACK;")
                raise HTTPException(status_code=400, detail="Insufficient funds in source account")

            cur.execute(
                "UPDATE accounts SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s;",
                (payload.amount, payload.source_acc)
            )
            cur.execute(
                "UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s;",
                (payload.amount, payload.target_acc)
            )
            cur.execute("COMMIT;")

            return {
                "status": "SUCCESS",
                "source": payload.source_acc,
                "target": payload.target_acc,
                "amount": float(payload.amount),
                "replica": REPLICA_NAME,
                "shard": SHARD_NAME
            }
    finally:
        conn.close()

@app.post("/2pc/prepare")
def prepare_transaction(payload: PreparePayload):
    logger.info(f"Received PREPARE for tx {payload.tx_id} ({payload.action} on {payload.account_id})")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN;")
            cur.execute("SELECT balance FROM accounts WHERE account_id = %s FOR UPDATE;", (payload.account_id,))
            row = cur.fetchone()

            if not row:
                cur.execute("ROLLBACK;")
                return {"vote": "NO", "reason": "Account not found"}

            if payload.action == "DEBIT":
                if row[0] < payload.amount:
                    cur.execute("ROLLBACK;")
                    return {"vote": "NO", "reason": "Insufficient funds"}
                cur.execute(
                    "UPDATE accounts SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s;",
                    (payload.amount, payload.account_id)
                )
            elif payload.action == "CREDIT":
                cur.execute(
                    "UPDATE accounts SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP WHERE account_id = %s;",
                    (payload.amount, payload.account_id)
                )
            else:
                cur.execute("ROLLBACK;")
                return {"vote": "NO", "reason": "Invalid action"}

            cur.execute(sql.SQL("PREPARE TRANSACTION {};").format(sql.Literal(payload.tx_id)))
            logger.info(f"Transaction {payload.tx_id} prepared successfully (Vote: YES)")
            return {"vote": "YES"}

    except Exception as e:
        logger.error(f"Error during PREPARE for tx {payload.tx_id}: {str(e)}")
        try:
            with conn.cursor() as cur:
                cur.execute("ROLLBACK;")
        except Exception:
            pass
        return {"vote": "NO", "reason": str(e)}
    finally:
        conn.close()

@app.post("/2pc/commit")
def commit_transaction(payload: TxDecisionPayload):
    logger.info(f"Received COMMIT for tx {payload.tx_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT gid FROM pg_prepared_xacts WHERE gid = %s;", (payload.tx_id,))
            if not cur.fetchone():
                logger.warning(f"Tx {payload.tx_id} not found in prepared transactions (already committed or resolved)")
                return {"status": "ALREADY_COMMITTED_OR_RESOLVED"}

            cur.execute(sql.SQL("COMMIT PREPARED {};").format(sql.Literal(payload.tx_id)))
            logger.info(f"Transaction {payload.tx_id} committed successfully")
            return {"status": "COMMITTED"}
    except Exception as e:
        logger.error(f"Error executing COMMIT PREPARED for tx {payload.tx_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/2pc/abort")
def abort_transaction(payload: TxDecisionPayload):
    logger.info(f"Received ABORT for tx {payload.tx_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT gid FROM pg_prepared_xacts WHERE gid = %s;", (payload.tx_id,))
            if not cur.fetchone():
                logger.warning(f"Tx {payload.tx_id} not found in prepared transactions (already aborted or resolved)")
                return {"status": "ALREADY_ABORTED_OR_RESOLVED"}

            cur.execute(sql.SQL("ROLLBACK PREPARED {};").format(sql.Literal(payload.tx_id)))
            logger.info(f"Transaction {payload.tx_id} rolled back successfully")
            return {"status": "ABORTED"}
    except Exception as e:
        logger.error(f"Error executing ROLLBACK PREPARED for tx {payload.tx_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()