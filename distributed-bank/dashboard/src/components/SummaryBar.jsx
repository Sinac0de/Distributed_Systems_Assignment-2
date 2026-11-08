import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCheck,
  DatabaseZap,
  Gauge,
  Layers,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { AnimatedNumber, Badge, Sparkline, cn } from './ui'
import { formatMoney, formatUptime, SHARD_KEYS } from '../lib/constants'

function StatCard({ children, className = '', accent = 'emerald', delay = 0 }) {
  const accents = {
    emerald: 'from-emerald-400/10',
    cyan: 'from-cyan-400/10',
    violet: 'from-violet-400/10',
    amber: 'from-amber-400/10',
  }
  return (
    <div
      className={cn(
        'panel group relative overflow-hidden p-4 transition duration-300 hover:border-white/[0.12]',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-70',
          accents[accent],
        )}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export function SummaryBar({
  liquidity,
  liquidityReady,
  conservationDelta,
  sampledCount,
  healthyCount,
  desiredReplicaCount,
  shardHealth,
  p95,
  latencies,
  routedRequests,
  settledCount,
  uptimeSeconds,
}) {
  const conserved = conservationDelta !== null && Math.abs(conservationDelta) < 0.005
  const totalDenominator = Math.max(desiredReplicaCount, healthyCount)
  const degraded = healthyCount < desiredReplicaCount

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Cluster summary">
      <StatCard accent="emerald" delay={0}>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Total system liquidity</p>
            <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-slate-50 xl:text-[28px]">
              <AnimatedNumber value={liquidity} format={(value) => formatMoney(value)} />
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Wallet size={16} strokeWidth={1.7} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {liquidityReady ? (
            <Badge tone={conserved ? 'emerald' : 'amber'} dot>
              {conserved ? 'conserved' : `Δ ${formatMoney(conservationDelta)}`}
            </Badge>
          ) : (
            <Badge tone="slate">sampling</Badge>
          )}
          <span className="font-mono text-[9.5px] text-slate-500">
            {sampledCount}/6 test accounts
          </span>
          <span className="hidden h-3 w-px bg-white/10 sm:block" />
          <span className="hidden font-mono text-[9.5px] text-emerald-400/70 sm:inline">
            Σ A + B = invariant
          </span>
        </div>
      </StatCard>

      <StatCard accent="cyan" delay={60}>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Active healthy replicas</p>
            <p className="mt-1.5 flex items-baseline gap-1.5 text-[26px] font-semibold tracking-tight text-slate-50 xl:text-[28px]">
              <AnimatedNumber value={healthyCount} format={(value) => Math.round(value)} />
              <span className="text-[15px] font-medium text-slate-500">/ {totalDenominator}</span>
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <Layers size={16} strokeWidth={1.7} />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {SHARD_KEYS.map((key) => {
            const shard = shardHealth[key]
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-9 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {key.replace('Shard-', 'Shard ')}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-all duration-700',
                      shard.degraded ? 'bg-rose-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400',
                    )}
                    style={{ width: `${(shard.healthy / shard.target) * 100}%` }}
                  />
                </span>
                <span
                  className={cn(
                    'w-7 text-right font-mono text-[9px] tabular-nums',
                    shard.degraded ? 'text-rose-300' : 'text-slate-400',
                  )}
                >
                  {shard.healthy}/{shard.target}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {degraded ? (
            <>
              <Activity size={10} className="text-rose-300" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-rose-300/90">
                degraded · failover active
              </span>
            </>
          ) : (
            <>
              <ShieldCheck size={10} className="text-emerald-300" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-300/80">
                all systems nominal
              </span>
            </>
          )}
        </div>
      </StatCard>

      <StatCard accent="violet" delay={120}>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Active protocol</p>
            <p className="mt-2 text-[19px] font-semibold tracking-tight text-slate-50">
              PostgreSQL 2PC
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">Native prepared transactions</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
            <DatabaseZap size={16} strokeWidth={1.7} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="violet" dot>
            durable WAL
          </Badge>
          <Badge tone="slate">PREPARE TRANSACTION</Badge>
        </div>
        <div className="mt-2 flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
          <CheckCheck size={10} className="text-emerald-400/80" />
          coordinator_tx_log · pg_prepared_xacts
        </div>
      </StatCard>

      <StatCard accent="amber" delay={180}>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Gateway latency · p95</p>
            <p className="mt-1.5 flex items-baseline gap-1 text-[26px] font-semibold tracking-tight text-slate-50 xl:text-[28px]">
              {p95 === null ? (
                <span className="text-slate-500">—</span>
              ) : (
                <>
                  <AnimatedNumber value={p95} format={(value) => Math.round(value)} />
                  <span className="text-[12px] font-medium text-slate-500">ms</span>
                </>
              )}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <Gauge size={16} strokeWidth={1.7} />
          </div>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[9.5px] text-slate-500">
              {routedRequests
                ? `${routedRequests} routed · ${settledCount} settled`
                : latencies.length
                  ? `${latencies.length} probe${latencies.length === 1 ? '' : 's'} · no transfers yet`
                  : 'awaiting routed traffic'}
            </p>
            <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
              {conserved ? (
                <ArrowDownRight size={10} className="text-emerald-400" />
              ) : (
                <ArrowUpRight size={10} className="text-amber-400" />
              )}
              round-robin · 1.5s probes
            </div>
            <p className="font-mono text-[9px] text-slate-600">session {formatUptime(uptimeSeconds)}</p>
          </div>
          <Sparkline
            values={latencies.slice(-22)}
            color="#fbbf24"
            className="h-9 w-[110px] shrink-0 opacity-90"
          />
        </div>
      </StatCard>
    </section>
  )
}
