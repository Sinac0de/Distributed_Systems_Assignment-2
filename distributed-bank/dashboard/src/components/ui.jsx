import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export function cn(...values) {
  return values.filter(Boolean).join(' ')
}

export function AnimatedNumber({ value, format = (v) => Math.round(v), className = '' }) {
  const [display, setDisplay] = useState(value ?? 0)
  const previous = useRef(value ?? 0)

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return undefined
    const from = previous.current
    const to = Number(value)
    previous.current = to
    if (from === to) {
      setDisplay(to)
      return undefined
    }
    const controls = animate(from, to, {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
    })
    return () => controls.stop()
  }, [value])

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className={className}>—</span>
  }

  return <span className={cn('tabular-nums', className)}>{format(display)}</span>
}

const dotStyles = {
  UP: {
    dot: 'bg-emerald-400',
    ring: 'bg-emerald-400/40',
    text: 'text-emerald-300',
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-400/10',
    label: 'UP',
  },
  DOWN: {
    dot: 'bg-rose-400',
    ring: 'bg-rose-400/40',
    text: 'text-rose-300',
    border: 'border-rose-400/30',
    bg: 'bg-rose-400/10',
    label: 'DOWN',
  },
  UNKNOWN: {
    dot: 'bg-slate-500',
    ring: 'bg-slate-400/20',
    text: 'text-slate-400',
    border: 'border-white/10',
    bg: 'bg-white/5',
    label: 'SYNC',
  },
}

export function StatusDot({ status = 'UNKNOWN', withLabel = false, className = '' }) {
  const style = dotStyles[status] || dotStyles.UNKNOWN
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative flex h-2 w-2 shrink-0">
        {status === 'UP' && (
          <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', style.ring)} />
        )}
        <span className={cn('relative h-2 w-2 rounded-full', style.dot)} />
      </span>
      {withLabel && (
        <span className={cn('font-mono text-[9px] font-semibold tracking-[0.12em]', style.text)}>
          {style.label}
        </span>
      )}
    </span>
  )
}

const badgeStyles = {
  emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  rose: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  blue: 'border-blue-400/25 bg-blue-400/10 text-blue-300',
  slate: 'border-white/10 bg-white/[0.04] text-slate-400',
}

export function Badge({ children, tone = 'slate', className = '', dot = false }) {
  return (
    <span className={cn('chip', badgeStyles[tone] || badgeStyles.slate, className)}>
      {dot && <span className="h-1 w-1 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Sparkline({ values = [], color = '#34d399', className = '', height = 34 }) {
  const gradientId = useId().replace(/:/g, '')
  const width = 132
  const pad = 3
  const data = values.length ? values : [0, 0]

  if (data.length === 1) data.push(data[0])
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = (width - pad * 2) / (data.length - 1)
  const points = data.map((value, index) => {
    const x = pad + index * step
    const y = pad + (height - pad * 2) * (1 - (value - min) / range)
    return [Number(x.toFixed(2)), Number(y.toFixed(2))]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const area = `${line} L${width - pad},${height} L${pad},${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={points.at(-1)[0]} cy={points.at(-1)[1]} r="2" fill={color} />
    </svg>
  )
}

export function FlowConnector({
  orientation = 'vertical',
  className = '',
  delay = 0,
  dim = false,
}) {
  const vertical = orientation === 'vertical'
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        vertical ? 'h-7 w-px' : 'h-px w-full',
        className,
      )}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: vertical
            ? `linear-gradient(180deg, rgba(52,211,153,${dim ? 0.12 : 0.42}), rgba(52,211,153,${dim ? 0.04 : 0.1}))`
            : `linear-gradient(90deg, rgba(52,211,153,${dim ? 0.1 : 0.4}), rgba(34,211,238,${dim ? 0.1 : 0.36}))`,
        }}
      />
      <span
        className={cn(
          'absolute h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_8px_2px_rgba(52,211,153,0.45)]',
          vertical
            ? 'left-1/2 top-0 -translate-x-1/2 animate-flow-down'
            : 'left-0 top-1/2 -translate-y-1/2 animate-flow-right',
        )}
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  )
}

export function Toasts({ toasts, onDismiss }) {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }
  const tones = {
    success: 'border-emerald-400/25 text-emerald-300',
    error: 'border-rose-400/25 text-rose-300',
    warning: 'border-amber-400/25 text-amber-300',
    info: 'border-cyan-400/25 text-cyan-300',
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-[#0b1017]/95 p-3 shadow-2xl backdrop-blur-xl',
                tones[toast.type] || tones.info,
              )}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-100">{toast.title}</p>
                {toast.message && (
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="rounded p-0.5 text-slate-500 transition hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function CopyButton({ value, className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn('icon-btn !px-2 !py-1', className)}
      title="Copy transaction ID"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="flex items-center gap-1 text-emerald-300"
          >
            <CheckCircle2 size={11} /> COPIED
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="flex items-center gap-1"
          >
            COPY
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
