import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCheck,
  CircleDot,
  Clock3,
  GitMerge,
  HardDriveDownload,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
  Zap,
} from 'lucide-react'
import { AnimatedNumber, Badge, CopyButton, StatusDot, cn } from './ui'
import { SHARDS, formatMoney, shortTime } from '../lib/constants'

const TWO_PC_STEPS = [
  {
    key: 'INITIATED',
    label: 'INITIATED',
    desc: 'Txn opened · WAL entry',
    icon: CircleDot,
  },
  {
    key: 'PREPARING',
    label: 'PREPARING',
    desc: 'Phase 1 · locks + votes',
    icon: LockKeyhole,
  },
  {
    key: 'COMMIT_DECIDED',
    label: 'COMMIT_DECIDED',
    desc: 'Durable log · fsync',
    icon: HardDriveDownload,
  },
  {
    key: 'COMPLETED',
    label: 'COMPLETED',
    desc: 'Phase 2 · COMMIT PREPARED',
    icon: CheckCheck,
  },
]

const LOCAL_STEPS = [
  { key: 'INITIATED', label: 'INITIATED', desc: 'Single-shard transaction', icon: CircleDot },
  { key: 'EXECUTING', label: 'EXECUTING', desc: 'Row locks · atomic update', icon: LockKeyhole },
  { key: 'COMPLETED', label: 'COMMITTED', desc: 'ACID transaction settled', icon: CheckCheck },
]

const STATE_ORDER = {
  INITIATED: 0,
  PREPARING: 1,
  EXECUTING: 1,
  COMMIT_DECIDED: 2,
  COMPLETED: 3,
  ABORTED: 3,
}

function RecoveryClock({ startedAt }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return <span className="tabular-nums">{seconds}s</span>
}

function VoteCard({ shardKey, account, vote }) {
  const shard = SHARDS[shardKey]
  const pending = vote === 'PENDING'
  const yes = vote === 'YES'
  const tone = yes ? 'emerald' : vote === 'NO' ? 'rose' : 'slate'

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
        yes
          ? 'border-emerald-400/20 bg-emerald-400/[0.045]'
          : vote === 'NO'
            ? 'border-rose-400/25 bg-rose-400/[0.045]'
            : 'border-white/[0.07] bg-white/[0.018]',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          shardKey === 'Shard-A'
            ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300'
            : 'border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300',
        )}
      >
        <Server size={12} />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
          {shard.label} participant
        </p>
        <p className="truncate text-[11px] font-medium text-slate-200">{account}</p>
      </div>
      <div className="ml-auto">
        {pending ? (
          <span className="chip border-white/10 bg-white/[0.03] text-[8px] text-slate-400">
            <Loader2 size={8} className="animate-spin" /> voting
          </span>
        ) : (
          <Badge tone={tone} className="!text-[8px]">
            {yes ? <Check size={8} /> : <X size={8} />} {vote}
          </Badge>
        )}
      </div>
    </div>
  )
}

function Stepper({ steps, activeIndex, state, local = false }) {
  const aborted = state === 'ABORTED'
  const complete = state === 'COMPLETED'
  const progress = complete ? 100 : (activeIndex / (steps.length - 1)) * 100

  return (
    <div className="relative">
      <div className="absolute left-[16%] right-[16%] top-[17px] h-px bg-white/[0.08]" />
      <motion.div
        className={cn(
          'absolute left-[16%] top-[17px] h-px',
          aborted
            ? 'bg-gradient-to-r from-emerald-400/60 to-rose-400/60'
            : local
              ? 'bg-gradient-to-r from-blue-400/70 to-emerald-400/70'
              : 'bg-gradient-to-r from-emerald-400/70 via-emerald-400/60 to-cyan-400/60',
        )}
        initial={false}
        animate={{ width: `${progress * 0.68}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const done = index < activeIndex || complete
          const active = index === activeIndex && !complete
          const stepAborted = aborted && index === steps.length - 1
          const isPrepare = step.key === 'PREPARING' && active
          const isInitiated = step.key === 'INITIATED' && active

          return (
            <div key={step.key} className="flex flex-col items-center text-center">
              <div className="relative mb-2 flex h-9 w-9 items-center justify-center">
                {active && (
                  <span
                    className={cn(
                      'absolute inset-0 rounded-full opacity-30',
                      isPrepare ? 'animate-pulse-ring bg-amber-400' : 'animate-pulse-ring bg-emerald-400',
                    )}
                  />
                )}
                <motion.div
                  layout
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full border text-[0px] transition-colors duration-300',
                    stepAborted
                      ? 'border-rose-400/50 bg-rose-400/15 text-rose-300'
                      : done
                        ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                        : active
                          ? isPrepare
                            ? 'border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_22px_-6px_rgba(251,191,36,0.6)]'
                            : isInitiated
                              ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-300'
                              : 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                          : 'border-white/10 bg-white/[0.025] text-slate-600',
                  )}
                >
                  {stepAborted ? (
                    <X size={14} />
                  ) : done ? (
                    <Check size={14} />
                  ) : active && (step.key === 'PREPARING' || step.key === 'INITIATED' || step.key === 'EXECUTING') ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <StepIcon size={14} />
                  )}
                </motion.div>
              </div>
              <p
                className={cn(
                  'font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em]',
                  stepAborted
                    ? 'text-rose-300'
                    : done
                      ? 'text-emerald-300/90'
                      : active
                        ? isPrepare
                          ? 'text-amber-300'
                          : 'text-cyan-200'
                        : 'text-slate-500',
                )}
              >
                {stepAborted ? 'ABORTED' : step.label}
              </p>
              <p className="mt-0.5 hidden font-mono text-[8px] leading-relaxed text-slate-600 md:block">
                {stepAborted ? 'Rollback resolved' : step.desc}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IdleState() {
  return (
    <div className="flex min-h-[272px] flex-col items-center justify-center px-4 py-8 text-center">
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-dashed border-white/10" />
        <div className="absolute inset-3 rounded-full border border-white/[0.07]" />
        <div className="absolute inset-0 animate-[spin_14s_linear_infinite]">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-violet-400/80 shadow-[0_0_10px_2px_rgba(167,139,250,0.4)]" />
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
          <GitMerge size={20} strokeWidth={1.6} />
        </div>
      </div>
      <p className="text-[13px] font-medium text-slate-200">No transaction in flight</p>
      <p className="mt-1 max-w-[330px] text-[11px] leading-relaxed text-slate-500">
        Run the cross-shard demo or submit a transfer across{' '}
        <span className="text-slate-300">A0000–A1000 → A1001–A2000</span> to visualize the two-phase
        commit lifecycle in real time.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {['INITIATED', 'PREPARE', 'COMMIT_DECIDED', 'COMPLETE'].map((label, index) => (
          <span key={label} className="flex items-center gap-1">
            <span className="chip border-white/[0.08] bg-white/[0.02] text-[8px] text-slate-500">
              {label}
            </span>
            {index < 3 && <ArrowRight size={8} className="text-slate-700" />}
          </span>
        ))}
      </div>
    </div>
  )
}

export function TransactionVisualizer({ tx, recovery, transferBusy, onRecover, coordinatorUp }) {
  const mode = tx?.mode || null
  const isLocal = mode === 'local'
  const steps = isLocal ? LOCAL_STEPS : TWO_PC_STEPS
  const state = tx?.state || 'INITIATED'
  const activeIndex = twoPcIndex(tx)
  const stateTone = stateToneFor(state)
  const recoveryActive =
    recovery && ['crashed', 'restarting', 'recovering'].includes(recovery.stage)

  if (!tx) {
    return (
      <section className="panel flex flex-col" aria-label="2PC execution visualizer">
        <div className="panel-head">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/[0.08] text-violet-300">
              <GitMerge size={15} />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">
                Live 2PC Execution
              </h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                two-phase commit state machine
              </p>
            </div>
          </div>
          <Badge tone="slate">idle</Badge>
        </div>
        <IdleState />
      </section>
    )
  }

  const logRows = tx.history || []
  const lastState = logRows.at(-1)?.state || state

  return (
    <section className="panel flex flex-col" aria-label="2PC execution visualizer">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border',
              isLocal
                ? 'border-blue-400/20 bg-blue-400/[0.08] text-blue-300'
                : 'border-violet-400/20 bg-violet-400/[0.08] text-violet-300',
            )}
          >
            <GitMerge size={15} />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">
              {isLocal ? 'Single-Shard Execution' : 'Live 2PC Execution'}
            </h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              {isLocal ? 'local atomic commit · no coordinator' : 'two-phase commit state machine'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={isLocal ? 'blue' : 'amber'} dot>
            {isLocal ? 'local transfer' : 'distributed 2pc'}
          </Badge>
          <Badge tone={stateTone} dot>
            {state.toLowerCase()}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {recoveryActive && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2',
              recovery.stage === 'crashed'
                ? 'border-rose-400/25 bg-rose-400/[0.06]'
                : 'border-amber-400/25 bg-amber-400/[0.06]',
            )}
          >
            {recovery.stage === 'crashed' ? (
              <ShieldAlert size={14} className="text-rose-300" />
            ) : (
              <RotateCcw size={13} className="animate-spin text-amber-300" />
            )}
            <span
              className={cn(
                'font-mono text-[9px] font-semibold uppercase tracking-[0.13em]',
                recovery.stage === 'crashed' ? 'text-rose-300' : 'text-amber-300',
              )}
            >
              {recovery.stage === 'crashed' ? 'coordinator offline' : 'recovery replay'}
            </span>
            <span className="text-[10.5px] text-slate-400">
              {recovery.stage === 'crashed'
                ? 'COMMIT_DECIDED is durably logged — participants are waiting for the coordinator to recover.'
                : recovery.stage === 'restarting'
                  ? 'Coordinator restarting — startup recovery will replay the durable decision.'
                  : 'Coordinator healthy — re-issuing COMMIT PREPARED to both participants.'}
            </span>
            <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-slate-500">
              <Timer size={9} />
              <RecoveryClock startedAt={recovery.startedAt} />
            </span>
          </div>
        )}

        {recovery && recovery.stage === 'recovered' && !transferBusy && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2">
            <ShieldCheck size={13} className="text-emerald-300" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-emerald-300">
              recovery verified
            </span>
            <span className="text-[10.5px] text-slate-400">
              Durable decision replayed after crash · balances reconciled · conservation Δ 0.00
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                tx
              </span>
              {isLocal ? (
                <span className="rounded-md border border-blue-400/20 bg-blue-400/[0.06] px-2 py-1 font-mono text-[10.5px] text-blue-200">
                  local · single-shard
                </span>
              ) : (
                <>
                  <code
                    className={cn(
                      'rounded-md border px-2 py-1 font-mono text-[10.5px]',
                      tx.id && !tx.id.startsWith('pending')
                        ? 'border-violet-400/20 bg-violet-400/[0.06] text-violet-200'
                        : 'border-white/10 bg-white/[0.03] text-slate-500',
                    )}
                  >
                    {tx.id || 'awaiting coordinator…'}
                  </code>
                  {tx.id && <CopyButton value={tx.id} />}
                </>
              )}
              {tx.crashed && (
                <Badge tone="rose" dot>
                  crashed after decision
                </Badge>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[10px] text-slate-200">
                {tx.source}
              </span>
              <ArrowRight size={11} className="text-slate-600" />
              <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[10px] text-slate-200">
                {tx.target}
              </span>
              <span className="ml-1 hidden font-mono text-[9px] text-slate-500 sm:inline">
                {tx.route}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="eyebrow">amount</p>
            <p className="text-[22px] font-semibold tracking-tight text-slate-50">
              <AnimatedNumber value={tx.amount} format={(value) => formatMoney(value)} />
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[8.5px] text-slate-500">
              <Clock3 size={8} />
              {tx.startedAt ? shortTime(tx.startedAt) : '—'}
            </p>
          </div>
        </div>

        <Stepper steps={steps} activeIndex={activeIndex} state={state} local={isLocal} />

        {isLocal ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <VoteCard
              shardKey={tx.source.startsWith('A1') ? 'Shard-B' : 'Shard-A'}
              account={`${tx.source} → ${tx.target}`}
              vote={state === 'COMPLETED' ? 'YES' : state === 'ABORTED' ? 'NO' : 'PENDING'}
            />
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-400/15 bg-blue-400/[0.035] px-2.5 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-400/15 bg-blue-400/[0.08] text-blue-300">
                <Zap size={12} />
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                  execution path
                </p>
                <p className="text-[10.5px] text-slate-300">
                  Single database · implicit ACID transaction
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <VoteCard shardKey="Shard-A" account={tx.source} vote={tx.votes?.source || 'PENDING'} />
            <VoteCard shardKey="Shard-B" account={tx.target} vote={tx.votes?.target || 'PENDING'} />
          </div>
        )}

        <div className="rounded-lg border border-white/[0.06] bg-black/35">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400/80" />
              {isLocal ? 'transaction log · replica WAL' : 'durable log tail · coordinator_tx_log'}
            </span>
            <span className="font-mono text-[8px] text-slate-600">
              {logRows.length} entries
            </span>
          </div>
          <div className="max-h-[112px] space-y-1 overflow-y-auto p-2 font-mono text-[9px]">
            {logRows.map((entry, index) => (
              <motion.div
                key={`${entry.state}-${entry.at}-${index}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <span className="text-slate-600">{shortTime(entry.at)}</span>
                <span
                  className={cn(
                    'h-1 w-1 shrink-0 rounded-full',
                    entry.state === 'COMPLETED'
                      ? 'bg-emerald-400'
                      : entry.state === 'ABORTED'
                        ? 'bg-rose-400'
                        : entry.state === 'COMMIT_DECIDED'
                          ? 'bg-emerald-400/80'
                          : entry.state === 'PREPARING'
                            ? 'bg-amber-400'
                            : 'bg-cyan-400',
                  )}
                />
                <span
                  className={cn(
                    'uppercase tracking-wider',
                    entry.state === 'COMPLETED'
                      ? 'text-emerald-300/90'
                      : entry.state === 'ABORTED'
                        ? 'text-rose-300'
                        : entry.state === 'COMMIT_DECIDED'
                          ? 'text-emerald-300/80'
                          : entry.state === 'PREPARING'
                            ? 'text-amber-300/90'
                            : 'text-slate-300',
                  )}
                >
                  {entry.state}
                </span>
                <span className="truncate text-slate-600">
                  {logDescription(entry.state, isLocal)}
                </span>
              </motion.div>
            ))}
            <div className="flex items-center gap-1 text-slate-700">
              <span className="text-emerald-500/70">$</span>
              <span className="h-2.5 w-1 animate-blink bg-slate-500/70" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5">
          {state === 'ABORTED' ? (
            <p className="flex items-center gap-1.5 text-[10px] text-rose-300/90">
              <ShieldAlert size={11} />
              {tx.error || 'Transaction aborted — participants rolled back to safe state'}
            </p>
          ) : state === 'COMPLETED' ? (
            <p className="flex items-center gap-1.5 text-[10px] text-emerald-300/90">
              <CheckCheck size={11} />
              {isLocal ? 'Atomic commit settled · single shard' : 'Committed · 2/2 participants ACK · no data loss'}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-mono text-[9.5px] text-slate-500">
              <Loader2 size={10} className="animate-spin text-amber-400" />
              {state === 'PREPARING'
                ? 'Awaiting participant votes…'
                : state === 'COMMIT_DECIDED'
                  ? 'Decision durable · executing phase 2…'
                  : 'Transaction in progress…'}
            </p>
          )}
          <div className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
            <StatusDot status={coordinatorUp === false && !isLocal ? 'DOWN' : 'UP'} />
            {isLocal ? 'direct replica path' : 'coordinator :8005'}
            {recovery?.stage === 'recovered' && (
              <span className="text-emerald-400/80">· replay ok</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function twoPcIndex(tx) {
  if (!tx) return 0
  if (tx.state === 'ABORTED') return tx.mode === 'local' ? 2 : 3
  if (tx.state === 'COMPLETED') {
    return tx.mode === 'local' ? 2 : 3
  }
  if (tx.state === 'EXECUTING') return 1
  return STATE_ORDER[tx.state] ?? 0
}

function stateToneFor(state) {
  if (state === 'COMPLETED') return 'emerald'
  if (state === 'ABORTED') return 'rose'
  if (state === 'PREPARING' || state === 'EXECUTING') return 'amber'
  if (state === 'COMMIT_DECIDED') return 'emerald'
  return 'cyan'
}

function logDescription(state, isLocal) {
  if (isLocal) {
    if (state === 'INITIATED') return 'BEGIN · transaction opened on replica'
    if (state === 'EXECUTING') return 'row locks acquired · applying debit/credit'
    if (state === 'COMPLETED') return 'COMMIT · replica ACK · atomic settle'
    if (state === 'ABORTED') return 'ROLLBACK · transaction reverted'
  }
  if (state === 'INITIATED') return 'INSERT INTO coordinator_tx_log'
  if (state === 'PREPARING') return 'PREPARE TRANSACTION emitted → participants'
  if (state === 'COMMIT_DECIDED') return 'UPDATE state = COMMIT_DECIDED · fsync'
  if (state === 'COMPLETED') return 'COMMIT PREPARED acknowledged 2/2'
  if (state === 'ABORTED') return 'ROLLBACK PREPARED / abort resolved'
  if (state === 'EXECUTING') return 'row locks acquired · applying debit/credit'
  return ''
}
