# Distributed Banking Cluster Visualizer

Dark-mode React control center for the Distributed Banking Platform demo. It visualizes
the gateway, the 2PC coordinator, both database shards, live traffic, failover, crash
recovery, and self-healing in real time.

## Requirements

- Node.js 18+ (tested on Node 22)
- The banking stack from the repository root:

```powershell
# from distributed-bank/
docker compose up -d
```

- The gateway must be reachable on `localhost:8080` and the coordinator on
  `localhost:8005` for Live mode.

## Run

```powershell
# from distributed-bank/dashboard/
npm install
npm run dev
```

Open <http://localhost:5173>.

Use the sun/moon button in the header to switch between the dark and light
themes. The choice is stored in `localStorage` and restored before first paint.

Production build / preview:

```powershell
npm run build
npm run preview   # http://localhost:4173
```

## How data flows

| Dashboard path       | Proxied to              | Purpose                                      |
| -------------------- | ----------------------- | -------------------------------------------- |
| `/api/gateway/*`     | `http://localhost:8080` | health, balance inquiry, transfers           |
| `/api/coordinator/*` | `http://localhost:8005` | direct 2PC crash drill                       |
| `/api/chaos/*`       | Vite middleware         | Docker stop/start/restart/restore for drills |

The cluster header polls `GET /api/gateway/health` every **1.5 s**. Balance and transfer
operations go through the gateway so shard-aware routing and replica resolution stay
real. The crash drill calls the coordinator's `/transactions/execute` endpoint directly
with `simulate_crash_after_decision=true`.

Point the proxies at another host with:

```powershell
$env:VITE_GATEWAY_URL = "http://192.168.1.50:8080"
$env:VITE_COORDINATOR_URL = "http://192.168.1.50:8005"
npm run dev
```

## Live vs Demo

- **Live** uses the gateway/coordinator APIs. If two consecutive health probes fail, the
  dashboard falls back to Demo telemetry automatically and shows a banner; choosing a
  mode manually disables that fallback.
- **Demo** is entirely client-side: seeded balances, ambient traffic, simulated 2PC,
  failover, self-healing, and crash recovery. It is meant for recording when the Docker
  stack is unavailable.

## Chaos controls

The chaos buttons are executed by a small Vite middleware that calls the host Docker CLI.
They therefore need `npm run dev` or `npm run preview` (not a static file server), and
the Docker engine must be running. Only these containers can be controlled:

`bank-server-a1`, `bank-server-a2`, `bank-server-b1`, `bank-server-b2`,
`coordinator`.

In Live mode the buttons disable themselves if the agent reports Docker unavailable.
In Demo mode the drills are simulated locally.

## Demo runbook

1. **Exp 5 · Local transfer** — `A0001 → A0002`, $50. Both accounts live in Shard-A, so
   the gateway routes directly to one replica. Expect `COMMITTED` with no coordinator.
2. **Exp 5 · Distributed 2PC** — `A0001 → A1001`, $75. Watch
   `INITIATED → PREPARING → COMMIT_DECIDED → COMPLETED`, participant votes, and the
   coordinator durable-log tail.
3. **Exp 6 · Crash recovery** — `A0600 → A1600`, $120. The coordinator exits after the
   durable `COMMIT_DECIDED`, the UI shows participants waiting, then the restarted
   coordinator replays the decision and the balances reconcile.
4. **Kill Server-A1** — stops the primary replica; traffic fails over to `Server-A2` and
   the self-healing controller spawns/registers a replacement.
5. **Trigger Self-Healing** — brings back any downed baseline replica.

All drills are safe to replay; **Restore cluster** starts every allowed container again.

## Notes

- The color palette is exposed as RGB CSS variables. Adding the `light` class to
  `<html>` remaps those variables, so both themes reuse the same utility classes.
- Liquidity and conservation are computed from a rotating sample of test accounts, so the
  displayed total can move by the amount of a transfer whose two accounts are not both in
  the current sample.
- Audit log pause buffers entries and flushes them on resume.
- The dashboard is presentation-only; it does not own any database state. All mutations go
  through the gateway or coordinator.
