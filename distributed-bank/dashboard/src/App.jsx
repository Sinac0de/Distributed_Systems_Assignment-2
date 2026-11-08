import { useDashboard } from './hooks/useDashboard'
import { Header } from './components/Header'
import { SummaryBar } from './components/SummaryBar'
import { Topology } from './components/Topology'
import { TransactionVisualizer } from './components/TransactionVisualizer'
import { OperationsPanel } from './components/OperationsPanel'
import { ChaosDock } from './components/ChaosDock'
import { LogConsole } from './components/LogConsole'
import { Toasts, cn } from './components/ui'
import { COORDINATOR_ENDPOINT, GATEWAY_ENDPOINT } from './lib/constants'

export default function App() {
  const dashboard = useDashboard()

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-slate-200">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 grid-surface opacity-40 [mask-image:radial-gradient(ellipse_at_50%_0%,black_20%,transparent_75%)]" />
        <div className="absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-emerald-500/[0.055] blur-[120px]" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-cyan-500/[0.04] blur-[130px]" />
        <div className="absolute -right-40 top-64 h-[480px] w-[480px] rounded-full bg-violet-500/[0.045] blur-[130px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />
      </div>

      <Toasts toasts={dashboard.toasts} onDismiss={dashboard.actions.dismissToast} />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header
          mode={dashboard.mode}
          setMode={dashboard.setMode}
          gatewayUp={dashboard.gatewayUp}
          coordinatorUp={dashboard.coordinatorUp}
          uptimeSeconds={dashboard.uptimeSeconds}
          healthyCount={dashboard.healthyCount}
          desiredReplicaCount={dashboard.desiredReplicaCount}
          autoFallback={dashboard.autoFallback}
        />

        <main className="mx-auto w-full max-w-[1680px] flex-1 space-y-3.5 px-3 py-3.5 sm:px-5 sm:py-4">
          <SummaryBar
            liquidity={dashboard.liquidity}
            liquidityReady={dashboard.liquidityReady}
            conservationDelta={dashboard.conservationDelta}
            sampledCount={dashboard.sampledCount}
            healthyCount={dashboard.healthyCount}
            desiredReplicaCount={dashboard.desiredReplicaCount}
            shardHealth={dashboard.shardHealth}
            p95={dashboard.p95}
            latencies={dashboard.latencies}
            routedRequests={dashboard.routedRequests}
            settledCount={dashboard.settledCount}
            uptimeSeconds={dashboard.uptimeSeconds}
          />

          <div className="grid items-start gap-3.5 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-3.5 xl:col-span-8">
              <Topology
                replicas={dashboard.replicas}
                counters={dashboard.counters}
                maxCounter={dashboard.maxCounter}
                gatewayUp={dashboard.gatewayUp}
                coordinatorUp={dashboard.coordinatorUp}
                lastServiced={dashboard.lastServiced}
                healing={dashboard.healing}
                settledCount={dashboard.settledCount}
                transferCount={dashboard.transferCount}
                routedRequests={dashboard.routedRequests}
                p95={dashboard.p95}
                onRestartReplica={dashboard.actions.restartReplica}
                restartBusy={dashboard.chaosBusy.restart}
                mode={dashboard.mode}
              />

              <TransactionVisualizer
                tx={dashboard.tx}
                recovery={dashboard.recovery}
                transferBusy={dashboard.transferBusy}
                coordinatorUp={dashboard.coordinatorUp}
              />

              <LogConsole
                logs={dashboard.logs}
                logsPaused={dashboard.logsPaused}
                pendingLogCount={dashboard.pendingLogCount}
                actions={dashboard.actions}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3.5 xl:col-span-4">
              <OperationsPanel
                onBalance={dashboard.actions.runBalance}
                onTransfer={dashboard.actions.runTransfer}
                onCrashDemo={dashboard.actions.runCrashDemo}
                balanceResult={dashboard.balanceResult}
                balanceBusy={dashboard.balanceBusy}
                transferBusy={dashboard.transferBusy}
                mode={dashboard.mode}
              />

              <ChaosDock
                chaosBusy={dashboard.chaosBusy}
                chaosAgent={dashboard.chaosAgent}
                actions={{
                  ...dashboard.actions,
                  runCrashDemo: dashboard.actions.runCrashDemo,
                }}
                replicas={dashboard.replicas}
                healing={dashboard.healing}
                coordinatorUp={dashboard.coordinatorUp}
                mode={dashboard.mode}
                transferBusy={dashboard.transferBusy}
                recovery={dashboard.recovery}
              />
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-slate-600">
              <span className="text-slate-500">Distributed Banking Platform</span>
              <span className="text-slate-700">/</span>
              <span>Assignment 2</span>
              <span className="text-slate-700">/</span>
              <span>fault-tolerant runtime lab</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                `gateway ${GATEWAY_ENDPOINT.replace('http://', '')}`,
                `coordinator ${COORDINATOR_ENDPOINT.replace('http://', '')}`,
                'shard-a + shard-b',
                '2pc native',
              ].map((item) => (
                <span
                  key={item}
                  className={cn(
                    'rounded border border-white/[0.06] bg-white/[0.015] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-slate-600',
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
