import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Biohazard,
  ChevronRight,
  CircleAlert,
  GaugeCircle,
  HeartPulse,
  Loader2,
  RotateCcw,
  ServerOff,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react'
import { Badge, cn } from './ui'
import { SHARDS } from '../lib/constants'

function ActionCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  badge,
  busy,
  disabled,
  onClick,
  index,
}) {
  const tones = {
    rose: {
      wrap: 'border-rose-400/15 bg-rose-400/[0.03] hover:border-rose-400/35 hover:bg-rose-400/[0.06]',
      icon: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
      badge: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    },
    amber: {
      wrap: 'border-amber-400/15 bg-amber-400/[0.03] hover:border-amber-400/35 hover:bg-amber-400/[0.06]',
      icon: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
      badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    },
    teal: {
      wrap: 'border-teal-400/15 bg-teal-400/[0.03] hover:border-teal-400/35 hover:bg-teal-400/[0.06]',
      icon: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
      badge: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
    },
  }
  const style = tones[tone]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={busy || disabled ? undefined : { x: 2 }}
      whileTap={busy || disabled ? undefined : { scale: 0.99 }}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-45',
        style.wrap,
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', style.icon)}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
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
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <ChevronRight
        size={13}
        className="shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
      />
    </motion.button>
  )
}

function ControllerPhase({ label, active, done }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full transition',
          done
            ? 'bg-emerald-400'
            : active
              ? 'animate-pulse bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.35)]'
              : 'bg-white/15',
        )}
      />
      <span
        className={cn(
          'font-mono text-[7px] uppercase tracking-[0.1em]',
          done ? 'text-emerald-400/80' : active ? 'text-teal-300' : 'text-slate-600',
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function ChaosDock({
  chaosBusy,
  chaosAgent,
  actions,
  replicas,
  healing,
  coordinatorUp,
  mode,
  transferBusy,
  recovery,
}) {
  const a1 = replicas['Shard-A'].find((replica) => replica.key === 'A1')
  const a1Down = a1?.status === 'DOWN'
  const healingActive = healing?.active
  const recovered = recovery?.stage === 'recovered'

  const agentConnected = chaosAgent.status === 'connected'
  const agentLabel =
    chaosAgent.status === 'checking'
      ? 'probing docker…'
      : agentConnected
        ? 'docker agent · connected'
        : 'docker agent · offline'

  return (
    <section className="panel flex flex-col overflow-hidden" aria-label="Chaos engineering">
      <div className="panel-head !border-rose-400/10 bg-gradient-to-r from-rose-500/[0.04] to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/[0.08] text-rose-300">
            <Biohazard size={15} />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-100">
              Chaos Engineering
            </h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              fault injection & recovery drills
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-rose-300/80">
            control dock
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-2">
          <CircleAlert size={12} className="mt-0.5 shrink-0 text-amber-400/80" />
          <p className="text-[9.5px] leading-relaxed text-slate-500">
            Buttons execute against the local Docker engine through the dashboard&apos;s dev control
            agent. If it is offline in {mode === 'mock' ? 'demo' : 'live'} mode, the drill is
            {mode === 'mock' ? ' simulated locally.' : ' reported without touching the cluster.'}
          </p>
        </div>

        <div className="space-y-2">
          <ActionCard
            tone="rose"
            icon={a1Down ? RotateCcw : ServerOff}
            title={a1Down ? 'Restart Server-A1' : 'Kill Server-A1'}
            subtitle={
              a1Down
                ? 'Replica stopped · restart it to restore the baseline pool'
                : 'Stop replica · instant failover to Server-A2 on next request'
            }
            badge={a1Down ? 'offline' : 'failover'}
            busy={chaosBusy.kill || (a1Down && chaosBusy.restart)}
            disabled={mode === 'live' && !agentConnected}
            onClick={() => (a1Down ? actions.restartReplica('bank-server-a1') : actions.stopReplica('bank-server-a1'))}
            index={0}
          />
          <ActionCard
            tone="amber"
            icon={coordinatorUp === false ? RotateCcw : Siren}
            title={coordinatorUp === false ? 'Restart Coordinator' : 'Crash Coordinator mid-2PC'}
            subtitle={
              coordinatorUp === false
                ? 'Restart :8005 and replay the durable decision log'
                : 'Halt after COMMIT_DECIDED · observe startup recovery'
            }
            badge={coordinatorUp === false ? 'recovery' : 'fault'}
            busy={chaosBusy.coordinator || transferBusy}
            disabled={(coordinatorUp === false && transferBusy) || (mode === 'live' && !agentConnected)}
            onClick={() =>
              coordinatorUp === false ? actions.restartCoordinator() : actions.runCrashDemo()
            }
            index={1}
          />
          <ActionCard
            tone="teal"
            icon={HeartPulse}
            title="Trigger Self-Healing"
            subtitle="Crash a replica · watch replacement spawn & auto-register"
            badge={healingActive ? 'running' : 'autonomous'}
            busy={chaosBusy.heal || healingActive}
            disabled={healingActive || transferBusy}
            onClick={actions.triggerSelfHealing}
            index={2}
          />
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/25 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <Activity size={9} /> self-healing controller
            </span>
            <span
              className={cn(
                'flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em]',
                healingActive ? 'text-teal-300' : 'text-emerald-400/80',
              )}
            >
              <span
                className={cn(
                  'h-1 w-1 rounded-full',
                  healingActive ? 'animate-ping bg-teal-400' : 'bg-emerald-400',
                )}
              />
              {healingActive ? `healing · ${healing.shard}` : 'armed · 3s reconcile'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ControllerPhase label="detect" active={healingActive} done={Boolean(healing)} />
            <ArrowRight size={7} className="mb-3 shrink-0 text-slate-700" />
            <ControllerPhase label="evict" active={false} done={Boolean(healing)} />
            <ArrowRight size={7} className="mb-3 shrink-0 text-slate-700" />
            <ControllerPhase
              label="spawn"
              active={healingActive}
              done={healing?.stage === 'resolved'}
            />
            <ArrowRight size={7} className="mb-3 shrink-0 text-slate-700" />
            <ControllerPhase
              label="register"
              active={false}
              done={healing?.stage === 'resolved'}
            />
          </div>
          {healing && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] pt-2">
              <Badge
                tone={healing.stage === 'resolved' ? 'emerald' : healing.stage === 'timeout' ? 'rose' : 'cyan'}
                className="!text-[7.5px]"
              >
                {healing.stage === 'resolved'
                  ? 'replacement online'
                  : healing.stage === 'timeout'
                    ? 'timeout'
                    : 'live polling'}
              </Badge>
              <span className="truncate font-mono text-[8.5px] text-slate-500">
                {healing.detail ||
                  `${SHARDS[healing.shard]?.label || healing.shard} · waiting for gateway health response`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-2 py-1.5">
            <Wrench size={11} className={agentConnected ? 'text-emerald-400/80' : 'text-slate-600'} />
            <div className="min-w-0">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-slate-600">
                control agent
              </p>
              <p
                className={cn(
                  'truncate font-mono text-[8.5px]',
                  agentConnected ? 'text-emerald-300/80' : 'text-slate-500',
                )}
              >
                {agentLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-2 py-1.5">
            <GaugeCircle size={11} className="text-violet-400/80" />
            <div className="min-w-0">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-slate-600">
                coordinator
              </p>
              <p
                className={cn(
                  'truncate font-mono text-[8.5px]',
                  coordinatorUp === false ? 'text-rose-300/80' : 'text-slate-400',
                )}
              >
                {coordinatorUp === false ? 'offline · recovering' : recovered ? 'replay verified' : 'online · durable WAL'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-slate-600">
            <ShieldCheck size={10} className="text-emerald-400/60" />
            recovery drills are non-destructive
          </div>
          <button
            type="button"
            onClick={actions.restoreCluster}
            disabled={chaosBusy.restore}
            className="icon-btn shrink-0 !border-emerald-400/20 !bg-emerald-400/[0.06] !text-emerald-300 hover:!bg-emerald-400/[0.12] disabled:opacity-50"
            title="Start all baseline containers and coordinator"
          >
            {chaosBusy.restore ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RotateCcw size={11} />
            )}
            Restore cluster
          </button>
        </div>
      </div>
    </section>
  )
}
