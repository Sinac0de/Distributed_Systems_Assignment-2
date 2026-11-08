import { Activity, Clock3, FlaskConical, Layers3, Radio, RefreshCw, WifiOff } from 'lucide-react'
import { Badge, cn } from './ui'
import { formatUptime } from '../lib/constants'

export function Header({
  mode,
  setMode,
  gatewayUp,
  coordinatorUp,
  uptimeSeconds,
  healthyCount,
  desiredReplicaCount,
  autoFallback,
}) {
  const liveDown = mode === 'live' && gatewayUp === false
  const connecting = mode === 'live' && gatewayUp === null

  const status =
    mode === 'mock'
      ? { tone: 'amber', label: 'DEMO TELEMETRY', dot: 'bg-amber-400' }
      : liveDown
        ? { tone: 'rose', label: 'GATEWAY OFFLINE', dot: 'bg-rose-400' }
        : connecting
          ? { tone: 'slate', label: 'CONNECTING', dot: 'bg-slate-400' }
          : { tone: 'emerald', label: 'LIVE · POLLING', dot: 'bg-emerald-400' }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#05070b]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Layers3 size={20} className="text-emerald-300" strokeWidth={1.7} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#05070b] bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.5)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-100 sm:text-[16px]">
                Distributed Banking Cluster Visualizer
              </h1>
              <Badge tone="slate" className="hidden !text-[8.5px] lg:inline-flex">
                v1.0
              </Badge>
            </div>
            <p className="mt-0.5 hidden items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500 sm:flex">
              Fault-tolerant runtime
              <span className="text-slate-700">/</span>
              2PC orchestration
              <span className="text-slate-700">/</span>
              self-healing mesh
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 md:flex">
            <Clock3 size={12} className="text-slate-500" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              Uptime
            </span>
            <span className="font-mono text-[11.5px] font-medium tabular-nums text-slate-200">
              {formatUptime(uptimeSeconds)}
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 lg:flex">
            <Activity size={12} className="text-slate-500" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              Replicas
            </span>
            <span className="font-mono text-[11.5px] font-medium text-slate-200">
              {healthyCount}/{Math.max(desiredReplicaCount, healthyCount)}
            </span>
          </div>

          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5',
              status.tone === 'emerald' && 'border-emerald-400/20 bg-emerald-400/[0.07]',
              status.tone === 'amber' && 'border-amber-400/20 bg-amber-400/[0.07]',
              status.tone === 'rose' && 'border-rose-400/20 bg-rose-400/[0.07]',
              status.tone === 'slate' && 'border-white/10 bg-white/[0.03]',
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={cn(
                  'absolute inset-0 rounded-full opacity-60',
                  status.dot,
                  status.tone === 'emerald' ? 'animate-pulse-ring' : 'animate-ping',
                )}
              />
              <span className={cn('relative h-1.5 w-1.5 rounded-full', status.dot)} />
            </span>
            <span
              className={cn(
                'font-mono text-[9px] font-semibold uppercase tracking-[0.14em]',
                status.tone === 'emerald' && 'text-emerald-300',
                status.tone === 'amber' && 'text-amber-300',
                status.tone === 'rose' && 'text-rose-300',
                status.tone === 'slate' && 'text-slate-400',
              )}
            >
              {status.label}
            </span>
          </div>

          <div className="flex items-center rounded-lg border border-white/[0.08] bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] transition',
                mode === 'live'
                  ? 'bg-emerald-400/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]'
                  : 'text-slate-500 hover:text-slate-300',
              )}
              title="Use live backend APIs"
            >
              <Radio size={11} />
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode('mock')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] transition',
                mode === 'mock'
                  ? 'bg-amber-400/15 text-amber-300 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.22)]'
                  : 'text-slate-500 hover:text-slate-300',
              )}
              title="Use synthetic fallback data"
            >
              <FlaskConical size={11} />
              Demo
            </button>
          </div>
        </div>
      </div>

      {(autoFallback || liveDown) && (
        <div className="border-t border-amber-400/15 bg-amber-400/[0.05]">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-2 px-4 py-2 font-mono text-[10px] text-amber-200/80 sm:px-6">
            {autoFallback ? <WifiOff size={12} /> : <RefreshCw size={12} className="animate-spin" />}
            <span>
              {autoFallback
                ? 'Gateway on localhost:8080 is unreachable. Synthetic demo telemetry is active so the recording can continue.'
                : 'Live gateway unreachable — waiting for health probe. Enter Demo mode if the stack is offline.'}
            </span>
            <span className="hidden text-amber-200/40 sm:inline">·</span>
            <span className="hidden text-amber-200/50 sm:inline">
              coordinator {coordinatorUp === false ? 'offline' : 'reachable'}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
