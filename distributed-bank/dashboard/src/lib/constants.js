export const SHARD_KEYS = ['Shard-A', 'Shard-B']

export const SHARDS = {
  'Shard-A': {
    key: 'Shard-A',
    label: 'Shard A',
    short: 'A',
    range: 'A0001 – A1000',
    rangeStart: 1,
    rangeEnd: 1000,
    accent: 'emerald',
    database: {
      name: 'DB-A',
      engine: 'PostgreSQL 15',
      note: 'max_prepared_transactions=100',
    },
    baseReplicas: [
      {
        key: 'A1',
        id: 'Server-A1',
        container: 'bank-server-a1',
        hostToken: 'bank-server-a1',
        port: 8001,
        role: 'Primary replica',
      },
      {
        key: 'A2',
        id: 'Server-A2',
        container: 'bank-server-a2',
        hostToken: 'bank-server-a2',
        port: 8002,
        role: 'Standby replica',
      },
    ],
  },
  'Shard-B': {
    key: 'Shard-B',
    label: 'Shard B',
    short: 'B',
    range: 'A1001 – A2000',
    rangeStart: 1001,
    rangeEnd: 2000,
    accent: 'cyan',
    database: {
      name: 'DB-B',
      engine: 'PostgreSQL 15',
      note: 'max_prepared_transactions=100',
    },
    baseReplicas: [
      {
        key: 'B1',
        id: 'Server-B1',
        container: 'bank-server-b1',
        hostToken: 'bank-server-b1',
        port: 8003,
        role: 'Primary replica',
      },
      {
        key: 'B2',
        id: 'Server-B2',
        container: 'bank-server-b2',
        hostToken: 'bank-server-b2',
        port: 8004,
        role: 'Standby replica',
      },
    ],
  },
}

export const BASE_REPLICAS = SHARD_KEYS.flatMap((key) => SHARDS[key].baseReplicas)
export const DESIRED_REPLICA_COUNT = BASE_REPLICAS.length

export const SAMPLED_ACCOUNTS = ['A0001', 'A0002', 'A0600', 'A1001', 'A1600', 'A1701']
export const EXPECTED_LIQUIDITY = SAMPLED_ACCOUNTS.length * 1000

export const GATEWAY_ENDPOINT = 'http://localhost:8080'
export const COORDINATOR_ENDPOINT = 'http://localhost:8005'
export const HEALTH_POLL_MS = 1500

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min))
}

export function accountNumber(value) {
  const match = /^A(\d{1,4})$/i.exec(String(value ?? '').trim())
  return match ? Number(match[1]) : null
}

export function normalizeAccount(value) {
  const raw = String(value ?? '').trim().toUpperCase()
  const num = accountNumber(raw)
  if (!num) return raw
  return `A${String(num).padStart(4, '0')}`
}

export function accountShard(value) {
  const num = accountNumber(value)
  if (num === null) return null
  if (num >= 1 && num <= 1000) return 'Shard-A'
  if (num >= 1001 && num <= 2000) return 'Shard-B'
  return null
}

export function validateAccount(value) {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return 'Account ID is required'
  if (!/^A\d{1,4}$/.test(raw)) return 'Use format A0001 – A2000'
  const num = accountNumber(raw)
  if (num === null || num < 1 || num > 2000) return 'Account outside configured shard ranges'
  return null
}

export function accountRangeLabel(value) {
  const shard = accountShard(value)
  return shard ? `${shard.replace('Shard-', 'Shard ')} · ${SHARDS[shard].range}` : 'Unmapped account'
}

export function formatMoney(value, options = {}) {
  const { compact = false, decimals = 2 } = options
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
  }).format(Number(value))
}

export function formatInt(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US').format(Number(value))
}

export function formatLatency(ms) {
  if (ms === null || ms === undefined) return '—'
  return `${Math.round(ms)} ms`
}

export function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function timestamp() {
  const date = new Date()
  const pad = (n, size = 2) => String(n).padStart(size, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
    date.getMilliseconds(),
    3,
  )}`
}

export function shortTime(value) {
  const date = new Date(value)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

export function hostFromUrl(url) {
  try {
    return new URL(url).hostname
  } catch {
    return String(url || '').replace(/^https?:\/\//, '').split(':')[0]
  }
}

export function prettyAutoReplica(host) {
  const suffix = host.match(/([0-9a-f]{6})$/i)?.[1] || host.slice(-6)
  return `AutoServer-${suffix}`
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`
}

export function makeTxId() {
  return `tx_${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
}

export function percent(value, max) {
  if (!max) return 0
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)))
}
