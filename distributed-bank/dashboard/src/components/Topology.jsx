import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Boxes,
  CloudCog,
  Database,
  GitMerge,
  Globe2,
  HeartPulse,
  Loader2,
  MonitorPlay,
  Network,
  Radar,
  RotateCcw,
  Route,
  Server,
  Sparkles,
  Waves,
} from 'lucide-react'
import { Badge, FlowConnector, StatusDot, cn } from './ui'
import { SHARD_KEYS, SHARDS, formatInt, formatLatency, percent } from '../lib/constants'

function Elapsed({ startedAt }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return <span className="font-mono text-[9px] tabular-nums text-slate-500">{seconds}s elapsed</span>
}

function HealingBanner({ healing }) {
  if (!healing) return null
  const resolved = healing.stage === 'resolved'
  const failed = healing.stage === 'timeout'

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2',
          resolved && 'border-emerald-400/25 bg-emerald-400/[0.07]',
          failed && 'border-rose-400/25 bg-rose-400/[0.07]',
          !resolved && !failed && 'border-teal-400/25 bg-teal-400/[0.06]',
        )}
      >
        {resolved ? (
          <HeartPulse size={14} className="text-emerald-300" />
        ) : failed ? (
          <Waves size={14} className="text-rose-300" />
        ) : (
          <Loader2 size={14} className="animate-spin text-teal-300" />
        )}
        <span
          className={cn(
            'font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]',
            resolved ? 'text-emerald-300' : failed ? 'text-rose-300' : 'text-teal-300',
          )}
        >
          {resolved ? 'replica registered' : failed ? 'healing timeout' : `self-healing · ${healing.shard}`}
        </span>
        <span className="text-[11px] text-slate-400">
          {resolved
            ? healing.detail
            : failed
              ? healing.detail
              : `Autonomous controller spawning replacement for ${healing.target || healing.shard} · polling Gateway every 1.5s`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!resolved && !failed && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-teal-400" />}
          <Elapsed startedAt={healing.startedAt} />
        </div>
        {!resolved && !failed && (
          <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '55%' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ReplicaNode({
  replica,
  count,
  maxCounter,
  serviced,
  onRestart,
  restartBusy,
}) {
  const down = replica.status === 'DOWN'
  const unknown = replica.status === 'UNKNOWN'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      title={replica.container}
      className={cn(
        'group relative overflow-hidden rounded-lg border p-2.5 transition-colors duration-300',
        down
          ? 'border-rose-400/25 bg-rose-500/[0.035]'
          : unknown
            ? 'border-white/[0.07] bg-white/[0.015]'
            : 'border-white/[0.08] bg-[#0b1117] hover:border-white/[0.16]',
        serviced && !down && 'border-emerald-400/50 bg-emerald-400/[0.055] shadow-[0_0_22px_-10px_rgba(52,211,153,0.65)]',
      )}
    >
      {serviced && (
        <motion.span
          layoutId="serviced-glow"
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-emerald-400/40"
        />
      )}
      <div className="flex items-center gap-1.5">
        <StatusDot status={replica.status} />
        <p
          className={cn(
            'truncate text-[12px] font-semibold tracking-tight',
            down ? 'text-rose-200/80' : unknown ? 'text-slate-400' : 'text-slate-100',
          )}
        >
          {replica.id}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {serviced && !down ? (
            <span className="chip border-emerald-400/25 bg-emerald-400/10 text-[8px] text-emerald-300">
              serviced {serviced.latency != null ? `${serviced.latency}ms` : ''}
            </span>
          ) : replica.dynamic ? (
            <span className="chip border-cyan-400/25 bg-cyan-400/10 text-[8px] text-cyan-300">
              <Sparkles size={8} /> dynamic
            </span>
          ) : down && onRestart ? (
            <button
              type="button"
              onClick={() => onRestart(replica.container)}
              disabled={restartBusy}
              className="rounded border border-rose-400/25 bg-rose-400/10 p-1 text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-40"
              title={`Restart ${replica.container}`}
            >
              <RotateCcw size={9} className={restartBusy ? 'animate-spin' : ''} />
            </button>
          ) : (
            <span
              className={cn(
                'font-mono text-[8px] font-semibold uppercase tracking-[0.1em]',
                down ? 'text-rose-400/80' : unknown ? 'text-slate-600' : 'text-emerald-400/80',
              )}
            >
              {down ? 'down' : unknown ? 'sync' : 'up'}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 truncate font-mono text-[9.5px] text-slate-500">
        {replica.role} · {typeof replica.port === 'number' ? `:${replica.port}` : ':auto'}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span className="flex items-center gap-1 font-mono text-[9.5px] tabular-nums text-slate-500">
          <Activity size={9} className={down ? 'text-rose-400/60' : 'text-slate-500'} />
          {formatInt(count)}
        </span>
        <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.span
            className={cn(
              'block h-full rounded-full',
              down ? 'bg-rose-400/50' : 'bg-gradient-to-r from-emerald-400/70 to-cyan-400/70',
            )}
            animate={{ width: `${count ? percent(count, maxCounter) : 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">req</span>
      </div>
    </motion.div>
  )
}

function DatabaseNode({ shard, linked }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
        linked
          ? 'border-white/[0.07] bg-white/[0.018]'
          : 'border-rose-400/15 bg-rose-500/[0.025]',
      )}
      title="Database availability inferred from replica health checks"
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          linked
            ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
            : 'border-rose-400/20 bg-rose-400/10 text-rose-300',
        )}
      >
        <Database size={13} />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-200">
          {shard.database.name}
          <span className="font-normal text-slate-500">· {shard.database.engine}</span>
        </p>
        <p className="truncate font-mono text-[8.5px] text-slate-500">{shard.database.note}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Badge tone={linked ? 'cyan' : 'rose'} className="!text-[8px]">
          2PC ready
        </Badge>
        <StatusDot status={linked ? 'UP' : 'DOWN'} />
      </div>
    </div>
  )
}

function ShardColumn({ shardKey, replicas, counters, maxCounter, lastServiced, onRestart, restartBusy }) {
  const shard = SHARDS[shardKey]
  const healthy = replicas.filter((replica) => replica.status === 'UP').length
  const degraded = healthy < 2
  const isA = shardKey === 'Shard-A'

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border font-mono text-[10px] font-semibold',
            isA
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
              : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
          )}
        >
          {shard.short}
        </span>
        <h3 className="text-[12.5px] font-semibold tracking-tight text-slate-100">{shard.label}</h3>
        <Badge tone={isA ? 'emerald' : 'cyan'} className="!text-[8.5px]">
          {shard.range}
        </Badge>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
          <span className={cn('h-1.5 w-1.5 rounded-full', degraded ? 'bg-rose-400' : 'bg-emerald-400')} />
          {healthy}/{Math.max(2, healthy)} online
        </span>
      </div>

      <div
        className={cn(
          'rounded-xl border p-2.5',
          degraded ? 'border-rose-400/20 bg-rose-500/[0.02]' : 'border-white/[0.06] bg-black/25',
        )}
      >
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence initial={false}>
            {replicas.map((replica) => (
              <ReplicaNode
                key={replica.key}
                replica={replica}
                count={counters[replica.key] || 0}
                maxCounter={maxCounter}
                serviced={
                  lastServiced && lastServiced.replicaKey === replica.key ? lastServiced : null
                }
                onRestart={onRestart}
                restartBusy={restartBusy}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="mt-2">
          <DatabaseNode shard={shard} linked={healthy > 0} />
        </div>
      </div>
    </div>
  )
}

export function Topology({
  replicas,
  counters,
  maxCounter,
  gatewayUp,
  coordinatorUp,
  lastServiced,
  healing,
  settledCount,
  transferCount,
  routedRequests,
  p95,
  onRestartReplica,
  restartBusy,
  mode,
}) {
  const shardARep = replicas['Shard-A']
  const shardBRep = replicas['Shard-B']
  const gatewayStatus = gatewayUp === null ? 'UNKNOWN' : gatewayUp ? 'UP' : 'DOWN'
  const coordinatorStatus = coordinatorUp === null ? 'UNKNOWN' : coordinatorUp ? 'UP' : 'DOWN'

  return (
    <section className="panel overflow-hidden" aria-label="Cluster topology">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
            <Network size={15} />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">Cluster Topology</h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              live health graph · shard-aware routing
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> up
          </span>
          <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> down
          </span>
          <span className="hidden h-3 w-px bg-white/10 sm:block" />
          <span className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400">
            <Radar size={10} className="text-emerald-400" />
            /health · 1.5s
          </span>
          <Badge tone={mode === 'mock' ? 'amber' : 'slate'} className="!text-[8px]">
            {mode === 'mock' ? 'synthetic' : 'live probes'}
          </Badge>
        </div>
      </div>

      <div className="grid-surface noise relative p-4 sm:p-5">
        <AnimatePresence>{healing && <HealingBanner healing={healing} />}</AnimatePresence>

        {/* Client */}
        <div className="flex flex-col gap-0 md:flex-row md:items-stretch">
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.018] px-3 py-2.5 md:w-[178px] md:shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
              <MonitorPlay size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-200">Operator Console</p>
              <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-500">
                REST · browser
              </p>
            </div>
            <StatusDot status="UP" className="ml-auto md:hidden" />
          </div>

          <div className="flex items-center gap-2 px-1 py-1 md:w-40 md:flex-none md:px-3 lg:w-52">
            <FlowConnector orientation="horizontal" className="flex-1" />
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.1em] text-slate-600">
              https <ArrowRight size={8} /> 8080
            </span>
            <FlowConnector orientation="horizontal" delay={900} className="flex-1" dim />
          </div>

          {/* Gateway */}
          <motion.div
            layout
            className={cn(
              'relative flex-1 overflow-hidden rounded-xl border bg-[#0a1114]/90 px-3.5 py-3',
              gatewayStatus === 'UP'
                ? 'border-emerald-400/20 shadow-[0_0_40px_-24px_rgba(52,211,153,0.5)]'
                : gatewayStatus === 'DOWN'
                  ? 'border-rose-400/30'
                  : 'border-white/10',
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Route size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12.5px] font-semibold tracking-tight text-slate-100">
                    Shard-Aware Gateway
                  </p>
                  <Badge tone="emerald" className="!text-[8px]">
                    :8080
                  </Badge>
                  <StatusDot status={gatewayStatus} withLabel />
                </div>
                <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-500">
                  round-robin LB · active health checks · shard map
                </p>
              </div>
              <div className="ml-auto hidden shrink-0 items-center gap-4 text-right sm:flex">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-wider text-slate-600">routed</p>
                  <p className="font-mono text-[11px] tabular-nums text-slate-200">
                    {formatInt(routedRequests)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-wider text-slate-600">p95</p>
                  <p className="font-mono text-[11px] tabular-nums text-emerald-300/90">
                    {formatLatency(p95)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip border-white/[0.08] bg-white/[0.025] text-[8px] text-slate-400">
                <Globe2 size={8} /> localhost:8080
              </span>
              <span className="chip border-white/[0.08] bg-white/[0.025] text-[8px] text-slate-400">
                <Boxes size={8} /> shard-map.json
              </span>
              <span className="hidden chip border-white/[0.08] bg-white/[0.025] text-[8px] text-slate-400 sm:inline-flex">
                <CloudCog size={8} /> RR index locked
              </span>
            </div>
          </motion.div>
        </div>

        {/* Gateway -> Coordinator */}
        <div className="relative flex h-9 items-center justify-center">
          <FlowConnector orientation="vertical" className="h-full" />
          <span className="absolute left-1/2 ml-3 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
            proxy · /transfer
          </span>
        </div>

        {/* Coordinator */}
        <div className="mx-auto w-full max-w-[470px]">
          <motion.div
            layout
            className={cn(
              'relative overflow-hidden rounded-xl border px-3.5 py-3',
              coordinatorStatus === 'UP'
                ? 'border-violet-400/20 bg-[#0d0b16]/90 shadow-[0_0_44px_-26px_rgba(167,139,250,0.6)]'
                : coordinatorStatus === 'DOWN'
                  ? 'border-rose-400/30 bg-rose-950/[0.12]'
                  : 'border-white/10 bg-[#0b0e14]/90',
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10 text-violet-300">
                <GitMerge size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12.5px] font-semibold tracking-tight text-slate-100">
                    Transaction Coordinator
                  </p>
                  <Badge tone="violet" className="!text-[8px]">
                    :8005
                  </Badge>
                  <StatusDot status={coordinatorStatus} withLabel />
                </div>
                <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-500">
                  2PC orchestrator · durable WAL · startup recovery
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-3 text-right">
                <div className="hidden sm:block">
                  <p className="font-mono text-[8px] uppercase tracking-wider text-slate-600">2PC tx</p>
                  <p className="font-mono text-[11px] tabular-nums text-slate-200">
                    {formatInt(settledCount)}
                  </p>
                </div>
                <div className="hidden rounded-md border border-white/[0.07] bg-white/[0.025] px-1.5 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-500 sm:block">
                  WAL
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="chip border-white/[0.08] bg-white/[0.025] text-[8px] text-slate-400">
                <Database size={8} /> coordinator_tx_log
              </span>
              <span className="chip border-violet-400/20 bg-violet-400/[0.06] text-[8px] text-violet-300/90">
                <Server size={8} /> crash-safe decision
              </span>
              <span className="ml-auto font-mono text-[8px] uppercase tracking-wider text-slate-600">
                {transferCount} transfers
              </span>
            </div>
          </motion.div>
        </div>

        {/* Coordinator -> shards bus */}
        <div className="relative hidden h-11 md:block" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-4 w-px bg-gradient-to-b from-violet-400/40 to-white/10" />
          <div className="absolute left-1/4 right-1/4 top-4 h-px bg-gradient-to-r from-emerald-400/25 via-white/10 to-cyan-400/25" />
          <div className="absolute left-1/4 top-4 h-7 w-px bg-gradient-to-b from-white/10 to-emerald-400/35">
            <span className="absolute -left-[2px] top-0 h-1 w-1 animate-flow-down rounded-full bg-emerald-300 shadow-[0_0_6px_1px_rgba(52,211,153,0.4)]" />
          </div>
          <div className="absolute right-1/4 top-4 h-7 w-px bg-gradient-to-b from-white/10 to-cyan-400/35">
            <span
              className="absolute -left-[2px] top-0 h-1 w-1 animate-flow-down rounded-full bg-cyan-300 shadow-[0_0_6px_1px_rgba(34,211,238,0.4)]"
              style={{ animationDelay: '700ms' }}
            />
          </div>
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-[#080c11] px-1.5 font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-600">
            participants
          </span>
        </div>
        <div className="flex justify-center py-2 md:hidden">
          <FlowConnector orientation="vertical" className="h-6" />
        </div>

        {/* Shards */}
        <div className="grid gap-4 md:grid-cols-2">
          <ShardColumn
            shardKey="Shard-A"
            replicas={shardARep}
            counters={counters}
            maxCounter={maxCounter}
            lastServiced={lastServiced}
            onRestart={onRestartReplica}
            restartBusy={restartBusy}
          />
          <ShardColumn
            shardKey="Shard-B"
            replicas={shardBRep}
            counters={counters}
            maxCounter={maxCounter}
            lastServiced={lastServiced}
            onRestart={onRestartReplica}
            restartBusy={restartBusy}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-slate-600">
            topology auto-discovers replicas from gateway /health
          </span>
          <span className="hidden items-center gap-1 font-mono text-[8.5px] text-slate-600 sm:flex">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" /> 1500ms poll
          </span>
        </div>
      </div>
    </section>
  )
}
