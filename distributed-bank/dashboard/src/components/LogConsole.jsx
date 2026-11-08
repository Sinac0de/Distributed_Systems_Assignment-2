import { useEffect, useRef } from 'react'
import { ArrowDownToLine, Pause, Play, Terminal, Trash2 } from 'lucide-react'
import { cn } from './ui'

const TAG_STYLES = {
  SYSTEM: 'text-slate-400',
  GATEWAY: 'text-emerald-300',
  'SHARD-A': 'text-blue-300',
  'SHARD-B': 'text-cyan-300',
  COORDINATOR: 'text-violet-300',
  '2PC': 'text-amber-300',
  CHAOS: 'text-rose-300',
  'SELF-HEAL': 'text-teal-300',
}

const LEVEL_STYLES = {
  error: 'text-rose-300/90',
  warn: 'text-amber-200/80',
  success: 'text-slate-200',
  info: 'text-slate-300/90',
  muted: 'text-slate-500',
}

export function LogConsole({ logs, logsPaused, pendingLogCount, actions }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (logsPaused) return
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [logs, logsPaused])

  return (
    <section className="panel overflow-hidden" aria-label="Live audit log">
      <div className="panel-head !py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
            <Terminal size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[12.5px] font-semibold tracking-tight text-slate-100">
                Live Audit Stream
              </h2>
              <span
                className={cn(
                  'flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[7.5px] font-semibold uppercase tracking-[0.1em]',
                  logsPaused
                    ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                    : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
                )}
              >
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    logsPaused ? 'bg-amber-400' : 'animate-pulse bg-emerald-400',
                  )}
                />
                {logsPaused ? 'paused' : 'streaming'}
              </span>
            </div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
              http requests · routing decisions · 2pc phase confirmations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[8px] text-slate-500 lg:flex">
            {['GATEWAY', 'SHARD-A', 'COORDINATOR', '2PC'].map((tag) => (
              <span key={tag} className="flex items-center gap-1">
                <span className={cn('h-1 w-1 rounded-full bg-current', TAG_STYLES[tag])} />
                <span className={TAG_STYLES[tag]}>{tag}</span>
              </span>
            ))}
          </span>
          <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[8px] tabular-nums text-slate-500">
            {logs.length} events
          </span>
          {pendingLogCount > 0 && (
            <span className="rounded-md border border-amber-400/20 bg-amber-400/[0.07] px-2 py-1 font-mono text-[8px] text-amber-300">
              +{pendingLogCount} buffered
            </span>
          )}
          <button type="button" onClick={actions.toggleLogsPause} className="icon-btn">
            {logsPaused ? <Play size={10} /> : <Pause size={10} />}
            {logsPaused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={actions.clearLogs} className="icon-btn hover:!text-rose-300">
            <Trash2 size={10} />
            Clear
          </button>
        </div>
      </div>

      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        <div
          ref={scrollRef}
          className="grid-surface h-[252px] overflow-y-auto px-3 py-2.5 font-mono text-[10.5px] leading-[1.65] sm:px-4"
        >
          {logs.length === 0 ? (
            <p className="text-slate-600">Awaiting cluster events…</p>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-2 rounded px-1 py-[1px] transition hover:bg-white/[0.025]"
              >
                <span className="shrink-0 tabular-nums text-slate-600">[{entry.time}]</span>
                <span
                  className={cn(
                    'w-[92px] shrink-0 font-semibold tracking-tight',
                    TAG_STYLES[entry.tag] || 'text-slate-400',
                  )}
                >
                  [{entry.tag}]
                </span>
                <span className={cn('min-w-0 break-words', LEVEL_STYLES[entry.level] || LEVEL_STYLES.info)}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
          <div className="flex items-center gap-1 px-1 pt-1 text-slate-700">
            <span className="text-emerald-500/70">visitor@cluster:~$</span>
            <span className="h-3 w-1.5 animate-blink bg-slate-500/70" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] bg-white/[0.012] px-3 py-1.5 sm:px-4">
          <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-wider text-slate-600">
            <span className="flex items-center gap-1 text-emerald-500/70">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
              4 streams attached
            </span>
            <span className="text-slate-700">/</span>
            <span>health cadence 1.5s</span>
            <span className="hidden text-slate-700 sm:inline">/</span>
            <span className="hidden sm:inline">client-side audit buffer</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">
            <ArrowDownToLine size={9} className={logsPaused ? 'text-amber-400/70' : 'text-emerald-400/70'} />
            {logsPaused ? 'autoscroll suspended' : 'autoscroll active'}
          </div>
        </div>
      </div>
    </section>
  )
}
