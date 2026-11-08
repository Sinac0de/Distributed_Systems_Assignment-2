import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownUp,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  GitMerge,
  Loader2,
  Search,
  Server,
  Siren,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Badge, cn } from './ui'
import {
  SHARDS,
  accountShard,
  formatLatency,
  formatMoney,
  normalizeAccount,
  validateAccount,
} from '../lib/constants'

function ShardPill({ shardKey }) {
  if (!shardKey) return null
  return (
    <Badge tone={shardKey === 'Shard-A' ? 'emerald' : 'cyan'} className="!text-[8px]">
      {SHARDS[shardKey].label}
    </Badge>
  )
}

function DemoButton({ tone, badge, title, subtitle, icon: Icon, onClick, disabled, index }) {
  const tones = {
    emerald: {
      wrap: 'border-emerald-400/15 bg-emerald-400/[0.035] hover:border-emerald-400/35 hover:bg-emerald-400/[0.07]',
      icon: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
      badge: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    },
    amber: {
      wrap: 'border-amber-400/15 bg-amber-400/[0.03] hover:border-amber-400/35 hover:bg-amber-400/[0.06]',
      icon: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
      badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    },
    rose: {
      wrap: 'border-rose-400/15 bg-rose-400/[0.03] hover:border-rose-400/35 hover:bg-rose-400/[0.06]',
      icon: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
      badge: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    },
  }
  const style = tones[tone]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      whileHover={disabled ? undefined : { x: 2 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-45',
        style.wrap,
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', style.icon)}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-100">{title}</span>
          <span
            className={cn(
              'rounded border px-1 py-0.5 font-mono text-[7.5px] font-semibold uppercase tracking-[0.08em]',
              style.badge,
            )}
          >
            {badge}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[8.5px] text-slate-500">{subtitle}</p>
      </div>
      <ArrowUpRight
        size={13}
        className="shrink-0 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-300"
      />
    </motion.button>
  )
}

export function OperationsPanel({
  onBalance,
  onTransfer,
  onCrashDemo,
  balanceResult,
  balanceBusy,
  transferBusy,
  mode,
}) {
  const [balanceAccount, setBalanceAccount] = useState('A0001')
  const [source, setSource] = useState('A0001')
  const [target, setTarget] = useState('A1001')
  const [amount, setAmount] = useState('75.00')

  const normalizedSource = normalizeAccount(source)
  const normalizedTarget = normalizeAccount(target)
  const sourceShard = accountShard(normalizedSource)
  const targetShard = accountShard(normalizedTarget)
  const bothValid =
    !validateAccount(normalizedSource) &&
    !validateAccount(normalizedTarget) &&
    normalizedSource !== normalizedTarget
  const crossShard = bothValid && sourceShard !== targetShard
  const local = bothValid && sourceShard === targetShard
  const amountValue = Number(amount)
  const amountValid = Number.isFinite(amountValue) && amountValue > 0

  const submitBalance = (event) => {
    event?.preventDefault()
    onBalance(balanceAccount)
  }

  const submitTransfer = (event) => {
    event?.preventDefault()
    if (!bothValid || !amountValid || transferBusy) return
    onTransfer({ source: normalizedSource, target: normalizedTarget, amount: amountValue })
  }

  const swapAccounts = () => {
    setSource(target)
    setTarget(source)
  }

  const runDemo = (kind) => {
    if (transferBusy) return
    if (kind === 'local') {
      setSource('A0001')
      setTarget('A0002')
      setAmount('50.00')
      onTransfer({ source: 'A0001', target: 'A0002', amount: 50 })
      return
    }
    if (kind === 'cross') {
      setSource('A0001')
      setTarget('A1001')
      setAmount('75.00')
      onTransfer({ source: 'A0001', target: 'A1001', amount: 75 })
      return
    }
    setSource('A0600')
    setTarget('A1600')
    setAmount('120.00')
    onCrashDemo()
  }

  return (
    <section className="panel flex flex-col" aria-label="Banking operations">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
            <ArrowLeftRight size={15} />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">
              Banking Operations
            </h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              gateway-connected quick actions
            </p>
          </div>
        </div>
        <Badge tone={mode === 'mock' ? 'amber' : 'emerald'} dot>
          {mode === 'mock' ? 'simulated api' : 'live api'}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">
        {/* Balance inquiry */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Search size={10} /> balance inquiry
            </p>
            <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">
              resolves replica
            </span>
          </div>
          <form onSubmit={submitBalance} className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={balanceAccount}
                onChange={(event) => setBalanceAccount(event.target.value.toUpperCase())}
                placeholder="A0001"
                maxLength={5}
                spellCheck={false}
                className="field !pl-8"
                aria-label="Account ID for balance inquiry"
              />
            </div>
            <button
              type="submit"
              disabled={balanceBusy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
            >
              {balanceBusy ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
              {balanceBusy ? 'Querying' : 'Query'}
            </button>
          </form>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">try</span>
            {['A0001', 'A0600', 'A1001'].map((account) => (
              <button
                key={account}
                type="button"
                onClick={() => setBalanceAccount(account)}
                className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[8px] text-slate-500 transition hover:border-white/20 hover:text-slate-300"
              >
                {account}
              </button>
            ))}
            <span className="ml-auto font-mono text-[8px] text-slate-600">rr → replica</span>
          </div>

          <div className="mt-2.5 min-h-[92px]">
            <AnimatePresence mode="wait" initial={false}>
              {balanceResult ? (
                <motion.div
                  key={`${balanceResult.at}-${balanceResult.error ? 'error' : 'ok'}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    'rounded-xl border p-3',
                    balanceResult.error
                      ? 'border-rose-400/25 bg-rose-400/[0.045]'
                      : 'border-emerald-400/15 bg-emerald-400/[0.035]',
                  )}
                >
                  {balanceResult.error ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-rose-300">
                          request failed
                        </span>
                        <span className="font-mono text-[8px] text-slate-500">
                          {balanceResult.accountId}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-rose-200/90">
                        {balanceResult.error}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-slate-500">
                            <Wallet size={9} /> {balanceResult.accountId} available balance
                          </p>
                          <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1 text-[21px] font-semibold tracking-tight text-slate-50"
                          >
                            {formatMoney(balanceResult.balance)}
                          </motion.p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <ShardPill shardKey={balanceResult.shard} />
                          <span className="font-mono text-[8px] text-slate-500">
                            {formatLatency(balanceResult.latency)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1.5">
                        <Server size={10} className="text-emerald-300" />
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">
                          serviced by
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-emerald-300">
                          {balanceResult.replica}
                        </span>
                        <span className="ml-auto flex items-center gap-1 font-mono text-[8px] text-emerald-400/70">
                          <CheckCircle2 size={9} /> exact replica
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-[92px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.012] text-center"
                >
                  <Server size={14} className="mb-1.5 text-slate-600" />
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
                    exact replica resolution appears here
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Transfer */}
        <form onSubmit={submitTransfer}>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <CircleDollarSign size={10} /> fund transfer
            </p>
            <button
              type="button"
              onClick={swapAccounts}
              className="icon-btn !px-1.5 !py-1"
              title="Swap source and target"
            >
              <ArrowDownUp size={11} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="transfer-source" className="label">
                source account
              </label>
              <input
                id="transfer-source"
                value={source}
                onChange={(event) => setSource(event.target.value.toUpperCase())}
                maxLength={5}
                spellCheck={false}
                className="field"
              />
              <p className="mt-1 font-mono text-[8px] text-slate-600">{sourceShard || 'unmapped'}</p>
            </div>
            <div>
              <label htmlFor="transfer-target" className="label">
                target account
              </label>
              <input
                id="transfer-target"
                value={target}
                onChange={(event) => setTarget(event.target.value.toUpperCase())}
                maxLength={5}
                spellCheck={false}
                className="field"
              />
              <p className="mt-1 font-mono text-[8px] text-slate-600">{targetShard || 'unmapped'}</p>
            </div>
          </div>

          <div className="mt-2">
            <label htmlFor="transfer-amount" className="label">
              amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-500">
                $
              </span>
              <input
                id="transfer-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                className="field !pl-7 !pr-24"
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {[50, 75, 120].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(value.toFixed(2))}
                    className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] text-slate-500 transition hover:text-slate-200"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'mt-2.5 flex items-start gap-2 rounded-lg border px-2.5 py-2',
              local && 'border-blue-400/25 bg-blue-400/[0.05]',
              crossShard && 'border-amber-400/25 bg-amber-400/[0.055]',
              !bothValid && 'border-white/[0.07] bg-white/[0.015]',
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                local && 'border-blue-400/20 bg-blue-400/10 text-blue-300',
                crossShard && 'border-amber-400/20 bg-amber-400/10 text-amber-300',
                !bothValid && 'border-white/10 bg-white/[0.03] text-slate-500',
              )}
            >
              {local ? <Zap size={11} /> : crossShard ? <GitMerge size={11} /> : <Sparkles size={11} />}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
                  local && 'text-blue-300',
                  crossShard && 'text-amber-300',
                  !bothValid && 'text-slate-500',
                )}
              >
                {local
                  ? 'local transfer'
                  : crossShard
                    ? 'distributed 2pc transfer'
                    : 'auto-detection'}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                {local
                  ? `Both accounts reside in ${sourceShard} · routed directly to a replica.`
                  : crossShard
                    ? `${sourceShard} → ${targetShard} · coordinator orchestrates PREPARE / COMMIT.`
                    : 'Enter two accounts in A0001–A2000 to auto-detect the execution path.'}
              </p>
            </div>
            {bothValid && (
              <span className="mt-0.5 shrink-0 font-mono text-[8px] text-slate-500">
                {SHARDS[sourceShard]?.range.split(' – ')[0]} → {SHARDS[targetShard]?.range.split(' – ')[1]}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!bothValid || !amountValid || transferBusy}
            className={cn(
              'group mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
              crossShard
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 shadow-[0_8px_30px_-12px_rgba(251,191,36,0.65)] hover:brightness-110'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-emerald-950 shadow-[0_8px_30px_-12px_rgba(52,211,153,0.6)] hover:brightness-110',
            )}
          >
            {transferBusy ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {crossShard ? 'Coordinating 2PC…' : 'Executing atomically…'}
              </>
            ) : (
              <>
                {crossShard ? <GitMerge size={13} /> : <Zap size={13} />}
                {crossShard ? 'Execute 2PC transfer' : 'Execute local transfer'}
                <ArrowRight
                  size={13}
                  className="transition group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
          <p className="mt-1.5 text-center font-mono text-[8px] text-slate-600">
            POST /api/gateway/transfer · {crossShard ? 'coordinator :8005' : 'shard replica'}
          </p>
        </form>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* One-click demos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Banknote size={10} /> video runbook
            </p>
            <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">
              1-click demos
            </span>
          </div>
          <div className="space-y-2">
            <DemoButton
              tone="emerald"
              badge="exp 5 · local"
              title="A0001 → A0002"
              subtitle="same-shard atomic · $50.00"
              icon={Zap}
              onClick={() => runDemo('local')}
              disabled={transferBusy}
              index={0}
            />
            <DemoButton
              tone="amber"
              badge="exp 5 · 2pc"
              title="A0001 → A1001"
              subtitle="cross-shard · $75.00 · full handshake"
              icon={GitMerge}
              onClick={() => runDemo('cross')}
              disabled={transferBusy}
              index={1}
            />
            <DemoButton
              tone="rose"
              badge="exp 6 · recovery"
              title="A0600 → A1600"
              subtitle="crash coordinator mid-2PC · $120.00"
              icon={Siren}
              onClick={() => runDemo('crash')}
              disabled={transferBusy}
              index={2}
            />
          </div>
          <p className="mt-2 font-mono text-[8px] leading-relaxed text-slate-600">
            demo buttons orchestrate the same APIs used above · safe to replay
          </p>
        </div>
      </div>
    </section>
  )
}
