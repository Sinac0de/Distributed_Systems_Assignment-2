import time
import subprocess
import concurrent.futures
from collections import Counter
import requests

GATEWAY_URL = "http://localhost:8080"
COORDINATOR_URL = "http://localhost:8005"
REPLICA_A1_URL = "http://localhost:8001"
REPLICA_B1_URL = "http://localhost:8003"

def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def run_cmd(cmd: list):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

# -------------------------------------------------------------
# Experiment 1: Shard Distribution & Shard-Aware Routing
# -------------------------------------------------------------
def test_experiment_1():
    print_header("EXPERIMENT 1: Shard Distribution & Shard-Aware Routing")

    res_a = requests.get(f"{GATEWAY_URL}/accounts/A0010/balance").json()
    res_b = requests.get(f"{GATEWAY_URL}/accounts/A1010/balance").json()

    print(f"Account A0010 routed to: {res_a.get('shard')} (Replica: {res_a.get('replica')})")
    print(f"Account A1010 routed to: {res_b.get('shard')} (Replica: {res_b.get('replica')})")

    assert res_a.get("shard") == "Shard-A", "Error: A0010 not mapped to Shard-A"
    assert res_b.get("shard") == "Shard-B", "Error: A1010 not mapped to Shard-B"
    print(">> Experiment 1 PASSED: Strict shard boundary routing verified.")

# -------------------------------------------------------------
# Experiment 2: Replica Load Distribution
# -------------------------------------------------------------
def test_experiment_2():
    print_header("EXPERIMENT 2: Replica Load Distribution (Round-Robin)")

    replica_counts = Counter()
    total_requests = 20

    for _ in range(total_requests):
        res = requests.get(f"{GATEWAY_URL}/accounts/A0050/balance").json()
        replica_counts[res.get("replica")] += 1

    print(f"Distribution of {total_requests} requests across Shard-A:")
    for rep, count in replica_counts.items():
        print(f"  - {rep}: {count} requests ({count / total_requests * 100:.1f}%)")

    assert len(replica_counts) > 1, "Load was not distributed across multiple replicas"
    print(">> Experiment 2 PASSED: Round-robin balancing verified.")

# -------------------------------------------------------------
# Experiment 3: Concurrent Operations on Same Shard (No Lost Updates)
# -------------------------------------------------------------
def test_experiment_3():
    print_header("EXPERIMENT 3: Concurrent Operations & Concurrency Control")

    target_acc = "A0200"
    init_res = requests.get(f"{GATEWAY_URL}/accounts/{target_acc}/balance").json()
    initial_balance = init_res["balance"]
    print(f"Initial balance of {target_acc}: {initial_balance}")

    num_ops = 20
    deposit_amount = 10.0

    def do_deposit():
        requests.post(f"{GATEWAY_URL}/accounts/{target_acc}/deposit", json={"amount": deposit_amount})

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(do_deposit) for _ in range(num_ops)]
        concurrent.futures.wait(futures)

    final_res = requests.get(f"{GATEWAY_URL}/accounts/{target_acc}/balance").json()
    final_balance = final_res["balance"]
    expected_balance = initial_balance + (num_ops * deposit_amount)

    print(f"Final balance: {final_balance} (Expected: {expected_balance})")
    assert final_balance == expected_balance, "Concurrency conflict: Lost updates detected"
    print(">> Experiment 3 PASSED: Pessimistic locking prevented lost updates.")

# -------------------------------------------------------------
# Experiment 4: Replica Interruption and Failover
# -------------------------------------------------------------
def test_experiment_4():
    print_header("EXPERIMENT 4: Replica Interruption and Gateway Failover")

    # Temporarily pause self-healing controller to isolate static replica failover
    run_cmd(["docker", "stop", "self-healing-controller"])

    print("Stopping container bank-server-a1...")
    run_cmd(["docker", "stop", "bank-server-a1"])
    time.sleep(3)  # Wait for health monitor detection

    print("Sending 5 balance queries to Shard A under degraded conditions:")
    for _ in range(5):
        res = requests.get(f"{GATEWAY_URL}/accounts/A0005/balance").json()
        rep = res.get("replica")
        print(f"  Replica handling request: {rep}")
        assert rep != "Server-A1", "Gateway routed to unhealthy replica"

    print("Restarting container bank-server-a1...")
    run_cmd(["docker", "start", "bank-server-a1"])
    time.sleep(3)  # Wait for replica re-registration

    # Resume self-healing controller
    run_cmd(["docker", "start", "self-healing-controller"])
    print(">> Experiment 4 PASSED: Gateway automatically detected failure and rerouted.")

# -------------------------------------------------------------
# Experiment 5: Local and Cross-Shard Transfers
# -------------------------------------------------------------
def test_experiment_5():
    print_header("EXPERIMENT 5: Local vs Cross-Shard Transfers")

    # Local Transfer (Shard-A to Shard-A)
    print("Executing Local Transfer: A0001 -> A0002 (Amount: 50.0)")
    res_local = requests.post(f"{GATEWAY_URL}/transfer", json={
        "source_acc": "A0001",
        "target_acc": "A0002",
        "amount": 50.0
    }).json()
    print(f"Local Transfer result: {res_local}")
    assert res_local.get("status") == "SUCCESS", "Local transfer failed"

    # Cross-Shard Transfer (Shard-A to Shard-B)
    print("Executing Cross-Shard Transfer (2PC): A0001 -> A1001 (Amount: 75.0)")
    res_cross = requests.post(f"{GATEWAY_URL}/transfer", json={
        "source_acc": "A0001",
        "target_acc": "A1001",
        "amount": 75.0
    }).json()
    print(f"Cross-Shard Transfer result: {res_cross}")
    assert res_cross.get("status") == "COMPLETED", "Cross-shard transfer failed"
    print(">> Experiment 5 PASSED: Local and 2PC cross-shard transfers completed successfully.")

# -------------------------------------------------------------
# Experiment 6: Interrupted Distributed Transaction & Recovery
# -------------------------------------------------------------
def test_experiment_6():
    print_header("EXPERIMENT 6: Interrupted Distributed Transaction & Recovery")

    src = "A0600"
    tgt = "A1600"
    amount = 120.0

    b_src_init = requests.get(f"{GATEWAY_URL}/accounts/{src}/balance").json()["balance"]
    b_tgt_init = requests.get(f"{GATEWAY_URL}/accounts/{tgt}/balance").json()["balance"]

    print(f"Initial balances: {src}={b_src_init}, {tgt}={b_tgt_init}")
    print("Triggering cross-shard transfer with simulated crash after COMMIT_DECIDED...")

    try:
        requests.post(
            f"{COORDINATOR_URL}/transactions/execute",
            json={"source_acc": src, "target_acc": tgt, "amount": amount, "simulate_crash_after_decision": True},
            timeout=3.0
        )
    except requests.exceptions.RequestException:
        print("Coordinator crashed as simulated.")

    time.sleep(2)
    print("Restarting Coordinator container...")
    run_cmd(["docker", "start", "coordinator"])

    print("Waiting for Coordinator recovery routine to complete...")
    coordinator_ready = False
    for _ in range(20):
        try:
            res = requests.get(f"{COORDINATOR_URL}/health", timeout=1.0)
            if res.status_code == 200:
                coordinator_ready = True
                break
        except Exception:
            pass
        time.sleep(1)

    assert coordinator_ready, "Coordinator failed to become healthy after restart"
    time.sleep(2)

    b_src_final = requests.get(f"{GATEWAY_URL}/accounts/{src}/balance").json()["balance"]
    b_tgt_final = requests.get(f"{GATEWAY_URL}/accounts/{tgt}/balance").json()["balance"]

    print(f"Post-recovery balances: {src}={b_src_final}, {tgt}={b_tgt_final}")
    assert b_src_final == b_src_init - amount, "Source debit was not finalized by recovery"
    assert b_tgt_final == b_tgt_init + amount, "Target credit was not finalized by recovery"
    print(">> Experiment 6 PASSED: Coordinator recovered durable decision without data loss.")

# -------------------------------------------------------------
# Experiment 7: Concurrent Cross-Shard Transfers (Conservation of Money)
# -------------------------------------------------------------
def test_experiment_7():
    print_header("EXPERIMENT 7: Concurrent Cross-Shard Transfers & Money Conservation")

    accounts = ["A0701", "A0702", "A1701", "A1702"]

    initial_total = sum(requests.get(f"{GATEWAY_URL}/accounts/{acc}/balance").json()["balance"] for acc in accounts)
    print(f"Total initial balance across test accounts: {initial_total}")

    transfers = [
        ("A0701", "A1701", 10.0),
        ("A1701", "A0702", 15.0),
        ("A0702", "A1702", 20.0),
        ("A1702", "A0701", 25.0),
        ("A0701", "A1702", 30.0),
        ("A1701", "A0701", 35.0),
    ]

    def send_transfer(src, tgt, amt):
        return requests.post(f"{GATEWAY_URL}/transfer", json={"source_acc": src, "target_acc": tgt, "amount": amt})

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(send_transfer, s, t, a) for s, t, a in transfers]
        concurrent.futures.wait(futures)

    final_total = sum(requests.get(f"{GATEWAY_URL}/accounts/{acc}/balance").json()["balance"] for acc in accounts)
    print(f"Total final balance across test accounts: {final_total}")

    assert initial_total == final_total, "Violation: Conservation of money failed under concurrency"
    print(">> Experiment 7 PASSED: Strict conservation of money maintained across shards.")

if __name__ == "__main__":
    test_experiment_1()
    test_experiment_2()
    test_experiment_3()
    test_experiment_4()
    test_experiment_5()
    test_experiment_6()
    test_experiment_7()
    print("\n" + "#" * 70)
    print("  ALL 7 EXPERIMENTS COMPLETED SUCCESSFULLY!")
    print("#" * 70)