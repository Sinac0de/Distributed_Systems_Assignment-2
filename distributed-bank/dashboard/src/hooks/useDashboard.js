import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  BASE_REPLICAS,
  DESIRED_REPLICA_COUNT,
  EXPECTED_LIQUIDITY,
  HEALTH_POLL_MS,
  SAMPLED_ACCOUNTS,
  SHARD_KEYS,
  SHARDS,
  accountShard,
  formatMoney,
  hostFromUrl,
  makeId,
  makeTxId,
  normalizeAccount,
  prettyAutoReplica,
  randomBetween,
  sleep,
  timestamp,
  validateAccount,
} from '../lib/constants'

const MAX_LOGS = 400

let logSequence = 0
let toastSequence = 0

function freshReplicas(status = 'UP') {
  const out = {}
  for (const key of SHARD_KEYS) {
    out[key] = SHARDS[key].baseReplicas.map((base) => ({
      ...base,
      shard: key,
      status,
      dynamic: false,
    }))
  }
  return out
}

function initialLogs(mode) {
  return [
    {
      id: ++logSequence,
      time: timestamp(),
      tag: 'SYSTEM',
      level: 'success',
      message: 'Visualizer boot sequence complete · React runtime online',
    },
    {
      id: ++logSequence,
      time: timestamp(),
      tag: 'SYSTEM',
      level: 'info',
      message:
        mode === 'mock'
          ? 'Demo data engine engaged · synthetic cluster telemetry active'
          : 'Connecting to Shard-Aware Gateway at localhost:8080 …',
    },
  ]
}

function initialBalances() {
  const out = {}
  for (const account of SAMPLED_ACCOUNTS) {
    out[account] = {
      account_id: account,
      balance: 1000,
      shard: accountShard(account),
      replica: '—',
    }
  }
  return out
}

function normaliseHealth(healthy) {
  const next = {}
  for (const shardKey of SHARD_KEYS) {
    const shard = SHARDS[shardKey]
    const urls = Array.isArray(healthy?.[shardKey]) ? healthy[shardKey] : []
    const hosts = urls.map(hostFromUrl)
    const list = shard.baseReplicas.map((base) => ({
      ...base,
      shard: shardKey,
      dynamic: false,
      status: hosts.some((host) => host.includes(base.hostToken)) ? 'UP' : 'DOWN',
    }))

    for (const host of hosts) {
      if (shard.baseReplicas.some((base) => host.includes(base.hostToken))) continue
      list.push({
        key: `auto:${host}`,
        id: prettyAutoReplica(host),
        container: host,
        hostToken: host,
        port: 'auto',
        role: 'Auto-scaled replica',
        shard: shardKey,
        dynamic: true,
        status: 'UP',
      })
    }

    next[shardKey] = list
  }
  return next
}

function txInitial({ mode, source, target, amount, route }) {
  const startedAt = Date.now()
  return {
    id: null,
    mode,
    state: 'INITIATED',
    source,
    target,
    amount,
    votes: { source: 'PENDING', target: 'PENDING' },
    route,
    startedAt,
    completedAt: null,
    error: null,
    crashed: false,
    abortPhase: null,
    replica: null,
    shard: null,
    history: [{ state: 'INITIATED', at: startedAt }],
  }
}

export function useDashboard() {
  const [mode, setMode] = useState('live')
  const [autoFallback, setAutoFallback] = useState(false)
  const [gatewayUp, setGatewayUp] = useState(null)
  const [coordinatorUp, setCoordinatorUp] = useState(null)
  const [chaosAgent, setChaosAgent] = useState({ status: 'checking', version: null })
  const [replicas, setReplicas] = useState(() => freshReplicas('UNKNOWN'))
  const [counters, setCounters] = useState({})
  const [lastServiced, setLastServiced] = useState(null)
  const [balances, setBalances] = useState({})
  const [balanceResult, setBalanceResult] = useState(null)
  const [balanceBusy, setBalanceBusy] = useState(false)
  const [tx, setTx] = useState(null)
  const [transferBusy, setTransferBusy] = useState(false)
  const [recovery, setRecovery] = useState(null)
  const [healing, setHealing] = useState(null)
  const [chaosBusy, setChaosBusy] = useState({})
  const [logs, setLogs] = useState(() => initialLogs('live'))
  const [logsPaused, setLogsPaused] = useState(false)
  const [pendingLogCount, setPendingLogCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const [latencies, setLatencies] = useState([])
  const [routedRequests, setRoutedRequests] = useState(0)
  const [transferCount, setTransferCount] = useState(0)
  const [settledCount, setSettledCount] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const modeRef = useRef(mode)
  const manualModeRef = useRef(false)
  const replicasRef = useRef(replicas)
  const balancesRef = useRef(balances)
  const pausedRef = useRef(false)
  const pendingLogsRef = useRef([])
  const txSequenceRef = useRef(0)
  const transferBusyRef = useRef(false)
  const balanceBusyRef = useRef(false)
  const gatewayConnectedRef = useRef(false)
  const coordinatorConnectedRef = useRef(false)
  const mockRoundRobinRef = useRef({ 'Shard-A': 0, 'Shard-B': 0 })
  const mockTimersRef = useRef([])
  const healingRef = useRef(null)
  const healingTimeoutRef = useRef(null)
  const serviceTimerRef = useRef(null)
  const startedAtRef = useRef(Date.now())

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    balancesRef.current = balances
  }, [balances])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const updateReplicas = useCallback((next) => {
    replicasRef.current = next
    setReplicas(next)
  }, [])

  const pushLog = useCallback((tag, message, level = 'info') => {
    const entry = { id: ++logSequence, time: timestamp(), tag, message, level }
    if (pausedRef.current) {
      pendingLogsRef.current.push(entry)
      setPendingLogCount(pendingLogsRef.current.length)
      return
    }
    setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), entry])
  }, [])

  const pushToast = useCallback((toast) => {
    const id = ++toastSequence
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }])
    const duration = toast.duration ?? 4200
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, duration)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const bumpReplica = useCallback((key) => {
    if (!key) return
    setCounters((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [])

  const markServiced = useCallback((replicaKey, replicaName, latency) => {
    const token = Date.now()
    setLastServiced({ replicaKey, replicaName, latency, token })
    if (serviceTimerRef.current) clearTimeout(serviceTimerRef.current)
    serviceTimerRef.current = setTimeout(() => {
      setLastServiced((current) => (current?.token === token ? null : current))
    }, 5500)
  }, [])

  const clearMockTimers = useCallback(() => {
    mockTimersRef.current.forEach((timer) => clearTimeout(timer))
    mockTimersRef.current = []
  }, [])

  const scheduleMock = useCallback((fn, delay) => {
    const timer = setTimeout(fn, delay)
    mockTimersRef.current.push(timer)
    return timer
  }, [])

  const finishHealing = useCallback(
    (shard, detail, replicaId = null) => {
      const current = healingRef.current
      if (!current?.active || current.shard !== shard) return
      const next = {
        ...current,
        active: false,
        stage: 'resolved',
        resolvedAt: Date.now(),
        detail,
        replicaId,
      }
      healingRef.current = next
      setHealing(next)
      if (healingTimeoutRef.current) clearTimeout(healingTimeoutRef.current)
      pushLog('SELF-HEAL', detail, 'success')
      pushToast({
        type: 'success',
        title: 'Replica restored',
        message: detail,
      })
      setTimeout(() => {
        if (healingRef.current?.stage === 'resolved') {
          healingRef.current = null
          setHealing(null)
        }
      }, 7000)
    },
    [pushLog, pushToast],
  )

  const startHealing = useCallback(
    (shard, target) => {
      const state = {
        active: true,
        stage: 'polling',
        shard,
        target,
        startedAt: Date.now(),
        detail: null,
        replicaId: null,
      }
      healingRef.current = state
      setHealing(state)
      pushLog(
        'SELF-HEAL',
        `Controller detected ${target || shard} unhealthy · replacement reconciliation scheduled`,
        'warn',
      )
      if (healingTimeoutRef.current) clearTimeout(healingTimeoutRef.current)
      healingTimeoutRef.current = setTimeout(() => {
        const current = healingRef.current
        if (!current?.active) return
        const failed = {
          ...current,
          active: false,
          stage: 'timeout',
          resolvedAt: Date.now(),
          detail: 'No replacement detected · verify the self-healing controller is running',
        }
        healingRef.current = failed
        setHealing(failed)
        pushLog('SELF-HEAL', failed.detail, 'error')
        pushToast({
          type: 'error',
          title: 'Self-healing timeout',
          message: failed.detail,
        })
        setTimeout(() => {
          if (healingRef.current?.stage === 'timeout') {
            healingRef.current = null
            setHealing(null)
          }
        }, 8000)
      }, 45000)
    },
    [pushLog, pushToast],
  )

  const applyLiveHealth = useCallback(
    (healthy) => {
      const next = normaliseHealth(healthy)
      const previous = replicasRef.current

      const previousByKey = new Map()
      for (const shardKey of SHARD_KEYS) {
        for (const replica of previous[shardKey] || []) {
          previousByKey.set(replica.key, replica)
        }
      }

      for (const shardKey of SHARD_KEYS) {
        for (const replica of next[shardKey]) {
          const before = previousByKey.get(replica.key)

          if (!before && replica.dynamic) {
            pushLog(
              'GATEWAY',
              `Dynamic replica registered · ${replica.id} joined ${shardKey} healthy pool`,
              'success',
            )
            const current = healingRef.current
            if (current?.active && current.shard === shardKey) {
              finishHealing(
                shardKey,
                `Replacement ${replica.id} spawned and auto-registered with Gateway`,
                replica.id,
              )
            }
          }

          if (before?.status === 'UP' && replica.status === 'DOWN' && !replica.dynamic) {
            pushLog(
              'GATEWAY',
              `Health probe failed · ${replica.id} evicted from ${shardKey} rotation`,
              'error',
            )
          }

          if (before?.status === 'DOWN' && replica.status === 'UP' && !replica.dynamic) {
            pushLog('GATEWAY', `${replica.id} healthy again · re-joined ${shardKey} rotation`, 'success')
          }
        }

        const healthyCount = next[shardKey].filter((replica) => replica.status === 'UP').length
        const current = healingRef.current
        if (current?.active && current.shard === shardKey && healthyCount >= 2) {
          const replacement = next[shardKey].find((replica) => replica.dynamic)
          finishHealing(
            shardKey,
            replacement
              ? `Shard capacity restored · ${replacement.id} auto-registered`
              : `${shardKey} capacity restored · ${healthyCount} replicas online`,
            replacement?.id || null,
          )
        }
      }

      for (const key of SHARD_KEYS) {
        for (const replica of previous[key] || []) {
          if (replica.dynamic && !next[key].some((item) => item.key === replica.key)) {
            pushLog('GATEWAY', `Replica ${replica.id} removed from healthy pool`, 'warn')
          }
        }
      }

      updateReplicas(next)
    },
    [finishHealing, pushLog, updateReplicas],
  )

  const spawnMockReplica = useCallback(
    (shardKey) => {
      const suffix = makeId('auto').split('_')[1]?.slice(0, 6) || '000000'
      const replica = {
        key: `auto:mock-${suffix}`,
        id: `AutoServer-${SHARDS[shardKey].short}-${suffix}`,
        container: `bank-server-${shardKey.toLowerCase()}-auto-${suffix}`,
        hostToken: `bank-server-${shardKey.toLowerCase()}-auto-${suffix}`,
        port: 'auto',
        role: 'Auto-scaled replica',
        shard: shardKey,
        dynamic: true,
        status: 'UP',
      }
      const next = {
        ...replicasRef.current,
        [shardKey]: [...replicasRef.current[shardKey], replica],
      }
      updateReplicas(next)
      pushLog(
        'GATEWAY',
        `Dynamic replica registered · ${replica.id} joined ${shardKey} healthy pool`,
        'success',
      )
      finishHealing(
        shardKey,
        `Replacement ${replica.id} spawned and auto-registered with Gateway`,
        replica.id,
      )
    },
    [finishHealing, pushLog, updateReplicas],
  )

  const markReplicaDown = useCallback(
    (container) => {
      const shardKey = SHARD_KEYS.find((key) =>
        replicasRef.current[key].some((replica) => replica.container === container),
      )
      if (!shardKey) return
      const target = replicasRef.current[shardKey].find((replica) => replica.container === container)
      const next = {
        ...replicasRef.current,
        [shardKey]: replicasRef.current[shardKey].map((replica) =>
          replica.container === container ? { ...replica, status: 'DOWN' } : replica,
        ),
      }
      updateReplicas(next)
      pushLog(
        'GATEWAY',
        `Health probe failed · ${target?.id || container} evicted from ${shardKey} rotation`,
        'error',
      )
      const remaining = next[shardKey].filter((replica) => replica.status === 'UP')
      if (remaining.length) {
        pushLog(
          'GATEWAY',
          `Round-robin pool updated · failing over to ${remaining.map((replica) => replica.id).join(', ')}`,
          'warn',
        )
      } else {
        pushLog('GATEWAY', `${shardKey} has no healthy replicas · requests will return 503`, 'error')
      }
    },
    [pushLog, updateReplicas],
  )

  const refreshLiquidity = useCallback(async () => {
    if (modeRef.current !== 'live') return
    const results = await Promise.all(
      SAMPLED_ACCOUNTS.map(async (account) => {
        try {
          const response = await api.getBalance(account)
          return { account, data: response.data }
        } catch {
          return null
        }
      }),
    )
    const valid = results.filter(Boolean)
    if (!valid.length) return
    setBalances((prev) => {
      const next = { ...prev }
      for (const item of valid) {
        next[item.account] = {
          account_id: item.account,
          balance: Number(item.data.balance),
          shard: item.data.shard,
          replica: item.data.replica,
        }
      }
      return next
    })
    setCounters((prev) => {
      const next = { ...prev }
      for (const item of valid) {
        const list = replicasRef.current[item.data.shard] || []
        const replica = list.find((entry) => entry.id === item.data.replica)
        if (replica) next[replica.key] = (next[replica.key] || 0) + 1
      }
      return next
    })
  }, [])

  /* ---------------------------------------------------------------- *
   * Live health polling
   * ---------------------------------------------------------------- */
  const fallbackToMock = useCallback(
    (reason) => {
      setAutoFallback(true)
      setMode('mock')
      pushLog('SYSTEM', `Live link lost (${reason}) · switching to demo data engine`, 'warn')
      pushToast({
        type: 'warning',
        title: 'Demo mode engaged',
        message: 'Gateway unreachable. Synthetic telemetry is now driving the dashboard.',
        duration: 7000,
      })
    },
    [pushLog, pushToast],
  )

  useEffect(() => {
    if (mode !== 'live') return undefined
    let cancelled = false
    let failures = 0

    const poll = async () => {
      const [gateway, coordinator] = await Promise.allSettled([
        api.gatewayHealth(),
        api.coordinatorHealth(),
      ])
      if (cancelled) return

      if (gateway.status === 'fulfilled') {
        failures = 0
        setGatewayUp(true)
        applyLiveHealth(gateway.value.data?.healthy_replicas)
        if (!gatewayConnectedRef.current) {
          gatewayConnectedRef.current = true
          const healthy = Object.values(gateway.value.data?.healthy_replicas || {}).reduce(
            (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
            0,
          )
          pushLog(
            'GATEWAY',
            `/health 200 · ${healthy} healthy replicas discovered · round-robin pools primed`,
            'success',
          )
        }
      } else {
        failures += 1
        setGatewayUp(false)
        gatewayConnectedRef.current = false
        if (failures >= 2 && !manualModeRef.current) {
          fallbackToMock('health probe timed out')
        }
      }

      if (coordinator.status === 'fulfilled') {
        setCoordinatorUp(true)
        if (!coordinatorConnectedRef.current) {
          coordinatorConnectedRef.current = true
          pushLog(
            'COORDINATOR',
            '/health 200 · durable WAL online · startup recovery supervisor armed',
            'success',
          )
        }
      } else {
        setCoordinatorUp(false)
        coordinatorConnectedRef.current = false
      }
    }

    poll()
    const interval = setInterval(poll, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [applyLiveHealth, fallbackToMock, mode, pushLog])

  /* ---------------------------------------------------------------- *
   * Liquidity sampler
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (mode !== 'live') return undefined
    refreshLiquidity()
    const interval = setInterval(refreshLiquidity, 12000)
    return () => clearInterval(interval)
  }, [mode, refreshLiquidity])

  /* ---------------------------------------------------------------- *
   * Docker control-agent probe
   * ---------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false
    api
      .chaosStatus()
      .then((response) => {
        if (cancelled) return
        setChaosAgent({
          status: response.data?.available ? 'connected' : 'offline',
          version: response.data?.version || null,
        })
      })
      .catch(() => {
        if (!cancelled) setChaosAgent({ status: 'offline', version: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * Mode transitions
   * ---------------------------------------------------------------- */
  useEffect(() => {
    clearMockTimers()
    txSequenceRef.current += 1
    setTx(null)
    setRecovery(null)
    setHealing(null)
    healingRef.current = null
    setLastServiced(null)
    setBalanceResult(null)
    setCounters({})
    setLatencies([])
    setRoutedRequests(0)
    setTransferCount(0)
    setSettledCount(0)
    gatewayConnectedRef.current = false
    coordinatorConnectedRef.current = false
    mockRoundRobinRef.current = { 'Shard-A': 0, 'Shard-B': 0 }

    if (mode === 'mock') {
      const next = freshReplicas('UP')
      updateReplicas(next)
      setGatewayUp(true)
      setCoordinatorUp(true)
      setBalances(initialBalances())
      setLatencies([18, 24, 19, 31, 26, 22, 17, 28, 23, 20, 25, 16])
      pushLog('SYSTEM', 'Demo data engine engaged · synthetic cluster telemetry active', 'warn')
    } else {
      updateReplicas(freshReplicas('UNKNOWN'))
      setBalances({})
      setGatewayUp(null)
      setCoordinatorUp(null)
      pushLog('SYSTEM', 'Attempting live connection to localhost:8080 …', 'info')
    }

    return () => clearMockTimers()
  }, [mode, clearMockTimers, pushLog, updateReplicas])

  /* ---------------------------------------------------------------- *
   * Mock ambient traffic
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (mode !== 'mock') return undefined
    const interval = setInterval(() => {
      if (Math.random() > 0.62) return
      const shardKey = SHARD_KEYS[Math.floor(Math.random() * SHARD_KEYS.length)]
      const healthy = replicasRef.current[shardKey].filter((replica) => replica.status === 'UP')
      if (!healthy.length) return
      const replica = healthy[Math.floor(Math.random() * healthy.length)]
      const account =
        shardKey === 'Shard-A'
          ? `A${String(randomBetween(1, 1000)).padStart(4, '0')}`
          : `A${String(randomBetween(1001, 2000)).padStart(4, '0')}`
      const latency = randomBetween(7, 38)
      setCounters((prev) => ({ ...prev, [replica.key]: (prev[replica.key] || 0) + 1 }))
      pushLog(
        'GATEWAY',
        `${account} → ${shardKey} via ${replica.id} · ${latency} ms · round-robin`,
        'muted',
      )
    }, 4800)
    return () => clearInterval(interval)
  }, [mode, pushLog])

  useEffect(() => {
    return () => {
      if (serviceTimerRef.current) clearTimeout(serviceTimerRef.current)
      if (healingTimeoutRef.current) clearTimeout(healingTimeoutRef.current)
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * Derived values
   * ---------------------------------------------------------------- */
  const sampledValues = SAMPLED_ACCOUNTS.map((account) => balances[account]).filter(Boolean)
  const liquidity = sampledValues.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const liquidityReady = sampledValues.length === SAMPLED_ACCOUNTS.length
  const conservationDelta = liquidityReady ? Number((liquidity - EXPECTED_LIQUIDITY).toFixed(2)) : null

  const healthyCount = SHARD_KEYS.reduce(
    (sum, key) => sum + replicas[key].filter((replica) => replica.status === 'UP').length,
    0,
  )

  const shardHealth = useMemo(() => {
    const out = {}
    for (const key of SHARD_KEYS) {
      const healthy = replicas[key].filter((replica) => replica.status === 'UP').length
      out[key] = {
        healthy,
        target: Math.max(2, healthy),
        total: replicas[key].length,
        degraded: healthy < 2,
      }
    }
    return out
  }, [replicas])

  const p95 = useMemo(() => {
    if (!latencies.length) return null
    const sorted = [...latencies].sort((a, b) => a - b)
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
    return Math.round(sorted[index])
  }, [latencies])

  const maxCounter = useMemo(() => {
    const values = Object.values(counters)
    return values.length ? Math.max(...values) : 0
  }, [counters])

  const resolveReplicaKey = useCallback((replicaName, shard) => {
    if (!shard) return null
    const list = replicasRef.current[shard] || []
    const direct = list.find((replica) => replica.id === replicaName)
    if (direct) return direct.key
    const suffix = String(replicaName || '').match(/([0-9a-f]{6})$/i)?.[1]
    const dynamic = list.find(
      (replica) => replica.dynamic && (!suffix || replica.key.toLowerCase().includes(suffix)),
    )
    return dynamic?.key || null
  }, [])

  const pickMockReplica = useCallback((shard) => {
    const healthy = replicasRef.current[shard].filter((replica) => replica.status === 'UP')
    if (!healthy.length) {
      throw new Error(`No healthy replicas available for ${shard} · Gateway would return 503`)
    }
    const index = mockRoundRobinRef.current[shard] % healthy.length
    mockRoundRobinRef.current[shard] += 1
    return healthy[index]
  }, [])

  const mockBalanceCall = useCallback(
    async (account) => {
      const shard = accountShard(account)
      const replica = pickMockReplica(shard)
      const started = performance.now()
      await sleep(randomBetween(70, 190))
      return {
        data: {
          account_id: account,
          balance: Number(balancesRef.current[account]?.balance ?? 1000),
          replica: replica.id,
          shard,
        },
        latency: Math.round(performance.now() - started),
        replicaKey: replica.key,
      }
    },
    [pickMockReplica],
  )

  const mockTransferCall = useCallback(
    async ({ source, target, amount }) => {
      const sourceShard = accountShard(source)
      const targetShard = accountShard(target)
      const started = performance.now()
      if (sourceShard !== targetShard) {
        const sourceReplica = pickMockReplica(sourceShard)
        const targetReplica = pickMockReplica(targetShard)
        await sleep(randomBetween(320, 620))
        return {
          data: {
            tx_id: makeTxId(),
            status: 'COMPLETED',
            source,
            target,
            amount,
          },
          latency: Math.round(performance.now() - started),
          participantKeys: [sourceReplica.key, targetReplica.key],
        }
      }
      const replica = pickMockReplica(sourceShard)
      await sleep(randomBetween(130, 270))
      return {
        data: {
          status: 'SUCCESS',
          source,
          target,
          amount,
          replica: replica.id,
          shard: sourceShard,
        },
        latency: Math.round(performance.now() - started),
        replicaKey: replica.key,
      }
    },
    [pickMockReplica],
  )

  const applyTxPatch = useCallback((patch) => {
    setTx((prev) => {
      if (!prev) return prev
      const stateChanged = patch.state && patch.state !== prev.state
      const history = stateChanged
        ? [...(prev.history || []), { state: patch.state, at: Date.now() }]
        : prev.history
      return { ...prev, ...patch, history }
    })
  }, [])

  const updateBalancesAfterTransfer = useCallback((source, target, amount) => {
    setBalances((prev) => {
      const next = { ...prev }
      if (next[source]) {
        next[source] = { ...next[source], balance: Number(next[source].balance) - amount }
      }
      if (next[target]) {
        next[target] = { ...next[target], balance: Number(next[target].balance) + amount }
      }
      return next
    })
  }, [])

  /* ---------------------------------------------------------------- *
   * Balance inquiry
   * ---------------------------------------------------------------- */
  const runBalance = useCallback(
    async (rawAccount) => {
      if (balanceBusyRef.current) return null
      const account = normalizeAccount(rawAccount)
      const validation = validateAccount(account)
      if (validation) {
        pushToast({ type: 'error', title: 'Invalid account', message: validation })
        return null
      }

      balanceBusyRef.current = true
      setBalanceBusy(true)

      try {
        const response =
          modeRef.current === 'mock' ? await mockBalanceCall(account) : await api.getBalance(account)
        const latency = response.latency ?? 0
        const data = response.data || {}
        const replicaKey =
          response.replicaKey ?? resolveReplicaKey(data.replica, data.shard)

        const result = {
          accountId: account,
          balance: Number(data.balance),
          replica: data.replica || 'unknown',
          shard: data.shard || accountShard(account),
          latency,
          at: Date.now(),
        }
        setBalanceResult(result)
        setBalances((prev) => ({
          ...prev,
          [account]: {
            account_id: account,
            balance: result.balance,
            shard: result.shard,
            replica: result.replica,
          },
        }))
        bumpReplica(replicaKey)
        markServiced(replicaKey, result.replica, latency)
        setLatencies((prev) => [...prev.slice(-39), latency])
        setRoutedRequests((value) => value + 1)

        pushLog(
          'GATEWAY',
          `GET /accounts/${account}/balance → ${result.shard} via ${result.replica} · ${latency} ms`,
          'info',
        )
        pushLog(
          result.shard === 'Shard-A' ? 'SHARD-A' : 'SHARD-B',
          `Balance ${formatMoney(result.balance)} served by ${result.replica} (${latency} ms)`,
          'success',
        )
        return result
      } catch (error) {
        const result = {
          accountId: account,
          error: error.message,
          at: Date.now(),
        }
        setBalanceResult(result)
        pushLog('GATEWAY', `GET /accounts/${account}/balance → ERROR · ${error.message}`, 'error')
        pushToast({
          type: 'error',
          title: 'Balance inquiry failed',
          message: error.message,
        })
        return null
      } finally {
        balanceBusyRef.current = false
        setBalanceBusy(false)
      }
    },
    [bumpReplica, markServiced, mockBalanceCall, pushLog, pushToast, resolveReplicaKey],
  )

  /* ---------------------------------------------------------------- *
   * Transfers (local + cross-shard 2PC)
   * ---------------------------------------------------------------- */
  const runTransfer = useCallback(
    async ({ source: rawSource, target: rawTarget, amount: rawAmount }) => {
      if (transferBusyRef.current) return { ok: false, error: 'Another transfer is running' }

      const source = normalizeAccount(rawSource)
      const target = normalizeAccount(rawTarget)
      const amount = Number(rawAmount)
      const sourceError = validateAccount(source)
      const targetError = validateAccount(target)

      if (sourceError || targetError) {
        pushToast({ type: 'error', title: 'Invalid account', message: sourceError || targetError })
        return { ok: false, error: sourceError || targetError }
      }
      if (source === target) {
        pushToast({
          type: 'error',
          title: 'Invalid transfer',
          message: 'Source and target must be different accounts',
        })
        return { ok: false, error: 'Source and target must differ' }
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        pushToast({ type: 'error', title: 'Invalid amount', message: 'Enter an amount greater than 0' })
        return { ok: false, error: 'Invalid amount' }
      }

      const sourceShard = accountShard(source)
      const targetShard = accountShard(target)
      const crossShard = sourceShard !== targetShard

      transferBusyRef.current = true
      setTransferBusy(true)
      const sequence = ++txSequenceRef.current
      const patch = (update) => {
        if (sequence === txSequenceRef.current) applyTxPatch(update)
      }

      setTx(
        txInitial({
          mode: crossShard ? '2pc' : 'local',
          source,
          target,
          amount,
          route: crossShard ? 'gateway → coordinator' : 'gateway',
        }),
      )
      const started = performance.now()
      let reportedLatency = null
      pushLog(
        'GATEWAY',
        `POST /transfer · ${source} → ${target} · ${formatMoney(amount)}`,
        'info',
      )
      if (crossShard) {
        pushLog(
          'GATEWAY',
          `Cross-shard boundary detected (${sourceShard} → ${targetShard}) · delegating to coordinator :8005`,
          'warn',
        )
        pushLog('COORDINATOR', 'Opening 2PC transaction · writing INITIATED to coordinator_tx_log', 'info')
      } else {
        pushLog(
          'GATEWAY',
          `Same-shard match · routing local transfer to ${sourceShard} round-robin replica`,
          'info',
        )
      }

      try {
        if (crossShard) {
          const pending =
            modeRef.current === 'mock'
              ? mockTransferCall({ source, target, amount }).then((value) => ({ ok: true, value }))
              : api.transfer({ source_acc: source, target_acc: target, amount }).then(
                  (value) => ({ ok: true, value }),
                  (error) => ({ ok: false, error }),
                )

          await sleep(240)
          patch({ state: 'PREPARING' })
          pushLog(
            '2PC',
            `Phase 1 · PREPARE emitted to both participants · locking ${source} and ${target}`,
            'warn',
          )

          const result = await pending
          if (sequence !== txSequenceRef.current) return { ok: false }

          if (!result.ok) {
            const error = result.error
            patch({
              state: 'ABORTED',
              votes: { source: 'NO', target: 'NO' },
              error: error.message,
              abortPhase: 'PREPARING',
              completedAt: Date.now(),
            })
            pushLog('2PC', `ABORT_DECIDED · ${error.message}`, 'error')
            pushLog('COORDINATOR', 'Rollback issued to prepared participants', 'warn')
            pushToast({
              type: 'error',
              title: 'Transfer aborted',
              message: error.message,
            })
            return { ok: false, error: error.message }
          }

          const data = result.value.data || {}
          reportedLatency = result.value.latency ?? Math.round(performance.now() - started)
          patch({
            id: data.tx_id || makeTxId(),
            state: 'PREPARING',
            votes: { source: 'YES', target: 'YES' },
          })
          pushLog(
            '2PC',
            `Votes received · ${sourceShard} = YES · ${targetShard} = YES · tx ${data.tx_id || 'n/a'}`,
            'success',
          )

          await sleep(620)
          if (sequence !== txSequenceRef.current) return { ok: false }
          patch({ state: 'COMMIT_DECIDED' })
          pushLog(
            'COORDINATOR',
            `Durable decision fsync'd · COMMIT_DECIDED → coordinator_tx_log (${data.tx_id || 'tx'})`,
            'success',
          )

          await sleep(720)
          if (sequence !== txSequenceRef.current) return { ok: false }
          patch({ state: 'COMPLETED', completedAt: Date.now() })
          pushLog('2PC', 'Phase 2 · COMMIT PREPARED acknowledged by 2/2 participants', 'success')
          pushLog('SHARD-A', `Debit settled · ${source} · ${formatMoney(amount)}`, 'success')
          pushLog('SHARD-B', `Credit settled · ${target} · ${formatMoney(amount)}`, 'success')

          ;(result.value.participantKeys || []).forEach((key) => bumpReplica(key))
          updateBalancesAfterTransfer(source, target, amount)
          setTransferCount((value) => value + 1)
          setSettledCount((value) => value + 1)
          pushToast({
            type: 'success',
            title: '2PC transfer committed',
            message: `${source} → ${target} · ${formatMoney(amount)} · tx ${data.tx_id || ''}`,
          })
        } else {
          const pending =
            modeRef.current === 'mock'
              ? mockTransferCall({ source, target, amount }).then(
                  (value) => ({ ok: true, value }),
                  (error) => ({ ok: false, error }),
                )
              : api.transfer({ source_acc: source, target_acc: target, amount }).then(
                  (value) => ({ ok: true, value }),
                  (error) => ({ ok: false, error }),
                )

          await sleep(180)
          patch({ state: 'EXECUTING' })
          pushLog(
            sourceShard === 'Shard-A' ? 'SHARD-A' : 'SHARD-B',
            `Atomic transaction opened on ${sourceShard} · acquiring row locks`,
            'info',
          )

          const result = await pending
          if (sequence !== txSequenceRef.current) return { ok: false }

          if (!result.ok) {
            const error = result.error
            patch({
              state: 'ABORTED',
              error: error.message,
              abortPhase: 'EXECUTING',
              completedAt: Date.now(),
            })
            pushLog(
              sourceShard === 'Shard-A' ? 'SHARD-A' : 'SHARD-B',
              `Local transaction rolled back · ${error.message}`,
              'error',
            )
            pushToast({ type: 'error', title: 'Local transfer failed', message: error.message })
            return { ok: false, error: error.message }
          }

          const response = result.value
          const data = response.data || {}
          const latency = response.latency ?? Math.round(performance.now() - started)
          reportedLatency = latency
          const replicaKey =
            response.replicaKey ?? resolveReplicaKey(data.replica, data.shard || sourceShard)

          patch({
            state: 'COMPLETED',
            completedAt: Date.now(),
            replica: data.replica || null,
            shard: data.shard || sourceShard,
          })
          bumpReplica(replicaKey)
          markServiced(replicaKey, data.replica || sourceShard, latency)
          updateBalancesAfterTransfer(source, target, amount)
          setTransferCount((value) => value + 1)
          setSettledCount((value) => value + 1)

          pushLog(
            data.shard === 'Shard-B' ? 'SHARD-B' : 'SHARD-A',
            `Local transfer committed atomically · ${formatMoney(amount)} · ${data.replica || sourceShard} · ${latency} ms`,
            'success',
          )
          pushToast({
            type: 'success',
            title: 'Local transfer settled',
            message: `${source} → ${target} · ${formatMoney(amount)}`,
          })
        }

        const latency = reportedLatency ?? Math.round(performance.now() - started)
        setLatencies((prev) => [...prev.slice(-39), latency])
        setRoutedRequests((value) => value + 1)
        pushLog('SYSTEM', `Request completed in ${latency} ms · money conservation intact`, 'muted')
        return { ok: true }
      } catch (error) {
        patch({
          state: 'ABORTED',
          error: error.message,
          abortPhase: 'PREPARING',
          completedAt: Date.now(),
        })
        pushLog('2PC', `Transaction aborted · ${error.message}`, 'error')
        pushToast({ type: 'error', title: 'Transfer failed', message: error.message })
        return { ok: false, error: error.message }
      } finally {
        transferBusyRef.current = false
        setTransferBusy(false)
        if (modeRef.current === 'live') refreshLiquidity()
      }
    },
    [
      applyTxPatch,
      bumpReplica,
      markServiced,
      mockTransferCall,
      pushLog,
      pushToast,
      refreshLiquidity,
      resolveReplicaKey,
      updateBalancesAfterTransfer,
    ],
  )

  /* ---------------------------------------------------------------- *
   * Crash & recovery experiment
   * ---------------------------------------------------------------- */
  const runCrashDemo = useCallback(async () => {
    if (transferBusyRef.current) return
    transferBusyRef.current = true
    setTransferBusy(true)
    const sequence = ++txSequenceRef.current
    const patch = (update) => {
      if (sequence === txSequenceRef.current) applyTxPatch(update)
    }
    const source = 'A0600'
    const target = 'A1600'
    const amount = 120

    setTx(
      txInitial({
        mode: '2pc',
        source,
        target,
        amount,
        route: 'gateway → coordinator',
      }),
    )
    setRecovery({ active: true, stage: 'initiating', startedAt: Date.now(), txId: null })
    pushLog('2PC', `Experiment 6 · INITIATED fault-injection transfer ${source} → ${target}`, 'warn')
    pushLog(
      'COORDINATOR',
      'POST /transactions/execute · simulate_crash_after_decision=true',
      'warn',
    )

    const started = performance.now()

    try {
      if (modeRef.current === 'mock') {
        await sleep(420)
        patch({ state: 'PREPARING' })
        pushLog('2PC', 'Phase 1 · PREPARE sent · participants locking rows', 'warn')
        await sleep(640)
        const txId = makeTxId()
        patch({
          id: txId,
          votes: { source: 'YES', target: 'YES' },
        })
        pushLog('2PC', `Votes received · Shard-A = YES · Shard-B = YES · ${txId}`, 'success')
        await sleep(260)
        patch({ state: 'COMMIT_DECIDED', crashed: true })
        setCoordinatorUp(false)
        setRecovery({ active: true, stage: 'crashed', startedAt: Date.now(), txId })
        pushLog('COORDINATOR', 'Simulated crash after durable COMMIT_DECIDED · process exited (1)', 'error')
        pushLog(
          'SYSTEM',
          'Recovery protocol will replay the durable decision when coordinator restarts',
          'warn',
        )

        await sleep(2800)
        setRecovery({ active: true, stage: 'recovering', startedAt: Date.now(), txId })
        setCoordinatorUp(true)
        pushLog('COORDINATOR', `Coordinator restarted · replaying unresolved transaction ${txId}`, 'info')
        await sleep(1100)
        patch({ state: 'COMPLETED', completedAt: Date.now(), crashed: false })
        setRecovery({ active: false, stage: 'recovered', startedAt: Date.now(), txId })
        pushLog('2PC', 'Recovery complete · COMMIT replayed on both participants', 'success')
      } else {
        const pending = api
          .coordinatorTransfer({
            source_acc: source,
            target_acc: target,
            amount,
            simulate_crash_after_decision: true,
          })
          .then(
            (value) => ({ ok: true, value }),
            (error) => ({ ok: false, error }),
          )

        await sleep(220)
        patch({ state: 'PREPARING' })
        pushLog('2PC', 'Phase 1 · PREPARE sent · participants locking rows', 'warn')

        const lookup = (async () => {
          await sleep(700)
          try {
            const response = await api.lastCoordinatorTx()
            return response.data?.tx_id || null
          } catch {
            return null
          }
        })()

        const result = await pending
        const txId = await lookup
        if (sequence !== txSequenceRef.current) return

        if (result.ok) {
          patch({
            id: result.value.data?.tx_id || txId,
            state: 'COMPLETED',
            votes: { source: 'YES', target: 'YES' },
            completedAt: Date.now(),
          })
          pushLog('2PC', 'Coordinator returned without crashing · transfer COMPLETED', 'success')
          setRecovery({ active: false, stage: 'recovered', startedAt: Date.now(), txId })
          updateBalancesAfterTransfer(source, target, amount)
          setSettledCount((value) => value + 1)
          return
        }

        patch({
          id: txId,
          state: 'COMMIT_DECIDED',
          votes: { source: 'YES', target: 'YES' },
          crashed: true,
        })
        setCoordinatorUp(false)
        setRecovery({ active: true, stage: 'crashed', startedAt: Date.now(), txId })
        pushLog(
          'COORDINATOR',
          `Connection dropped · coordinator terminated after durable decision${txId ? ` (${txId})` : ''}`,
          'error',
        )

        await sleep(1600)
        setRecovery({ active: true, stage: 'restarting', startedAt: Date.now(), txId })
        pushLog('SYSTEM', 'Restarting coordinator container via local control agent …', 'warn')
        try {
          await api.chaosAction('restart', 'coordinator')
          pushLog('SYSTEM', 'docker restart coordinator · accepted', 'info')
        } catch (error) {
          pushLog('SYSTEM', `Control agent unavailable · restart manually: docker start coordinator`, 'error')
          pushToast({
            type: 'warning',
            title: 'Manual recovery required',
            message: 'Run "docker start coordinator" — the dashboard is polling for its return.',
            duration: 9000,
          })
        }

        let recovered = false
        for (let attempt = 0; attempt < 40; attempt += 1) {
          try {
            await api.coordinatorHealth()
            recovered = true
            break
          } catch {
            await sleep(1000)
          }
        }
        if (sequence !== txSequenceRef.current) return

        setCoordinatorUp(recovered)
        if (!recovered) {
          setRecovery({ active: false, stage: 'failed', startedAt: Date.now(), txId })
          pushLog('SYSTEM', 'Coordinator did not return to the health endpoint', 'error')
          pushToast({
            type: 'error',
            title: 'Recovery failed',
            message: 'Coordinator is still offline. Start it and press Recover again.',
          })
          return
        }

        setRecovery({ active: true, stage: 'recovering', startedAt: Date.now(), txId })
        pushLog('COORDINATOR', 'Coordinator healthy · executing startup recovery routine', 'info')
        await sleep(1400)

        let finalState = null
        if (txId) {
          for (let attempt = 0; attempt < 12; attempt += 1) {
            try {
              const response = await api.transactionStatus(txId)
              finalState = response.data?.state || null
              if (finalState === 'COMPLETED' || finalState === 'ABORTED') break
            } catch {
              /* recovery may still be in flight */
            }
            await sleep(900)
          }
        }

        if (finalState === 'ABORTED') {
          patch({ state: 'ABORTED', error: 'Coordinator recovered and rolled back the transaction' })
          pushLog('2PC', 'Recovery resolved transaction as ABORTED', 'error')
          setRecovery({ active: false, stage: 'failed', startedAt: Date.now(), txId })
          return
        }

        patch({ state: 'COMPLETED', completedAt: Date.now(), crashed: false })
        setRecovery({ active: false, stage: 'recovered', startedAt: Date.now(), txId })
        pushLog(
          '2PC',
          `Recovery complete · durable decision replayed · ${txId || 'transaction'} COMPLETED`,
          'success',
        )
      }

      updateBalancesAfterTransfer(source, target, amount)
      setTransferCount((value) => value + 1)
      setSettledCount((value) => value + 1)
      setRoutedRequests((value) => value + 1)
      pushToast({
        type: 'success',
        title: 'Coordinator recovered',
        message: 'Durable COMMIT_DECIDED survived the crash · no data loss.',
        duration: 7000,
      })
      pushLog('SYSTEM', 'Money conservation verified after recovery · Δ 0.00', 'success')
    } catch (error) {
      patch({ state: 'ABORTED', error: error.message, abortPhase: 'PREPARING' })
      setRecovery({ active: false, stage: 'failed', startedAt: Date.now(), txId: null })
      pushLog('SYSTEM', `Crash experiment failed · ${error.message}`, 'error')
      pushToast({ type: 'error', title: 'Experiment failed', message: error.message })
    } finally {
      transferBusyRef.current = false
      setTransferBusy(false)
      if (modeRef.current === 'live') refreshLiquidity()
    }
  }, [
    applyTxPatch,
    pushLog,
    pushToast,
    refreshLiquidity,
    updateBalancesAfterTransfer,
  ])

  /* ---------------------------------------------------------------- *
   * Chaos controls
   * ---------------------------------------------------------------- */
  const stopReplica = useCallback(
    async (container) => {
      if (chaosBusy.kill) return
      const base = BASE_REPLICAS.find((replica) => replica.container === container)
      if (!base) return
      const shardKey = SHARD_KEYS.find((key) => SHARDS[key].baseReplicas.some((r) => r.container === container))
      setChaosBusy((prev) => ({ ...prev, kill: true }))
      pushLog('CHAOS', `docker stop ${container} · graceful termination (1s timeout)`, 'warn')

      try {
        if (modeRef.current === 'mock') {
          await sleep(360)
          markReplicaDown(container)
          startHealing(shardKey, base.id)
          scheduleMock(() => spawnMockReplica(shardKey), randomBetween(3600, 5200))
          pushToast({
            type: 'warning',
            title: 'Replica terminated',
            message: `${base.id} stopped · Gateway will fail over to the remaining replica.`,
          })
        } else {
          const response = await api.chaosAction('stop', container)
          if (!response.data?.ok) throw new Error(response.data?.error || 'Docker stop failed')
          startHealing(shardKey, base.id)
          pushLog('CHAOS', `${container} stopped · awaiting gateway health eviction`, 'warn')
          pushToast({
            type: 'warning',
            title: 'Replica terminated',
            message: `${base.id} stopped. Watch Gateway evict it and re-route traffic.`,
          })
        }
      } catch (error) {
        pushLog('CHAOS', `Control agent error · ${error.message}`, 'error')
        pushToast({
          type: 'error',
          title: 'Chaos control unavailable',
          message: `${error.message}. Run the dashboard with "npm run dev" on the Docker host, or use Demo mode.`,
          duration: 8000,
        })
      } finally {
        setChaosBusy((prev) => ({ ...prev, kill: false }))
      }
    },
    [chaosBusy.kill, markReplicaDown, pushLog, pushToast, scheduleMock, spawnMockReplica, startHealing],
  )

  const triggerSelfHealing = useCallback(async () => {
    if (chaosBusy.heal) return
    const candidates = [
      ...replicasRef.current['Shard-B'],
      ...replicasRef.current['Shard-A'],
    ].filter((replica) => !replica.dynamic && replica.status === 'UP')
    const target = candidates[0]
    if (!target) {
      pushToast({ type: 'warning', title: 'Nothing to heal', message: 'All baseline replicas are already down.' })
      return
    }

    setChaosBusy((prev) => ({ ...prev, heal: true }))
    pushLog('SELF-HEAL', `Fault drill · terminating ${target.id} to trigger autonomous reconciliation`, 'warn')

    try {
      if (modeRef.current === 'mock') {
        markReplicaDown(target.container)
        startHealing(target.shard, target.id)
        scheduleMock(() => spawnMockReplica(target.shard), randomBetween(3400, 4800))
      } else {
        const response = await api.chaosAction('stop', target.container)
        if (!response.data?.ok) throw new Error(response.data?.error || 'Docker stop failed')
        startHealing(target.shard, target.id)
        pushLog(
          'SELF-HEAL',
          `${target.id} terminated · controller polls every 3s and will spawn a replacement container`,
          'warn',
        )
      }
      pushToast({
        type: 'info',
        title: 'Self-healing drill running',
        message: 'Watch the topology: a replacement replica should auto-register with the Gateway.',
        duration: 6500,
      })
    } catch (error) {
      pushLog('SELF-HEAL', `Control agent unavailable · ${error.message}`, 'error')
      pushToast({ type: 'error', title: 'Chaos control unavailable', message: error.message })
    } finally {
      setChaosBusy((prev) => ({ ...prev, heal: false }))
    }
  }, [chaosBusy.heal, markReplicaDown, pushLog, pushToast, scheduleMock, spawnMockReplica, startHealing])

  const restartReplica = useCallback(
    async (container) => {
      setChaosBusy((prev) => ({ ...prev, restart: true }))
      pushLog('CHAOS', `docker restart ${container} requested`, 'info')
      try {
        if (modeRef.current === 'mock') {
          await sleep(600)
          updateReplicas({
            ...replicasRef.current,
            ...Object.fromEntries(
              SHARD_KEYS.map((key) => [
                key,
                replicasRef.current[key].map((replica) =>
                  replica.container === container ? { ...replica, status: 'UP' } : replica,
                ),
              ]),
            ),
          })
          pushLog('GATEWAY', `${container} healthy again · re-joined rotation`, 'success')
        } else {
          await api.chaosAction('restart', container)
          pushLog('CHAOS', `${container} restart sent · awaiting health probe`, 'info')
        }
        pushToast({ type: 'success', title: 'Replica restarting', message: container })
      } catch (error) {
        pushLog('CHAOS', `Restart failed · ${error.message}`, 'error')
        pushToast({ type: 'error', title: 'Restart failed', message: error.message })
      } finally {
        setChaosBusy((prev) => ({ ...prev, restart: false }))
      }
    },
    [pushLog, pushToast, updateReplicas],
  )

  const restoreCluster = useCallback(async () => {
    if (chaosBusy.restore) return
    setChaosBusy((prev) => ({ ...prev, restore: true }))
    pushLog('CHAOS', 'Restore cluster · starting baseline replicas and coordinator', 'warn')
    try {
      if (modeRef.current === 'mock') {
        clearMockTimers()
        updateReplicas(freshReplicas('UP'))
        setGatewayUp(true)
        setCoordinatorUp(true)
        setHealing(null)
        healingRef.current = null
        pushLog('SYSTEM', 'Demo cluster restored to nominal state', 'success')
      } else {
        const response = await api.restoreCluster()
        const failed = (response.data?.results || []).filter((item) => !item.ok)
        pushLog(
          'CHAOS',
          failed.length
            ? `Restore completed with ${failed.length} failure(s)`
            : 'All baseline containers started · health probes resuming',
          failed.length ? 'warn' : 'success',
        )
        setHealing(null)
        healingRef.current = null
      }
      pushToast({ type: 'success', title: 'Cluster restore issued', message: 'Polling for healthy replicas…' })
    } catch (error) {
      pushLog('CHAOS', `Restore failed · ${error.message}`, 'error')
      pushToast({ type: 'error', title: 'Restore failed', message: error.message })
    } finally {
      setChaosBusy((prev) => ({ ...prev, restore: false }))
    }
  }, [chaosBusy.restore, clearMockTimers, pushLog, pushToast, updateReplicas])

  const restartCoordinator = useCallback(async () => {
    setChaosBusy((prev) => ({ ...prev, coordinator: true }))
    try {
      if (modeRef.current === 'mock') {
        await sleep(1500)
        setCoordinatorUp(true)
      } else {
        await api.chaosAction('restart', 'coordinator')
      }
      pushLog('COORDINATOR', 'Coordinator restart issued · recovery routine will replay durable log', 'info')
      pushToast({ type: 'info', title: 'Coordinator restarting', message: 'Recovery replay in progress…' })
    } catch (error) {
      pushToast({ type: 'error', title: 'Coordinator restart failed', message: error.message })
    } finally {
      setChaosBusy((prev) => ({ ...prev, coordinator: false }))
    }
  }, [pushLog, pushToast])

  const setModeSafe = useCallback((nextMode) => {
    manualModeRef.current = true
    setAutoFallback(false)
    setMode(nextMode)
  }, [])

  const toggleLogsPause = useCallback(() => {
    setLogsPaused((prev) => {
      const next = !prev
      pausedRef.current = next
      if (!next && pendingLogsRef.current.length) {
        const buffered = pendingLogsRef.current
        pendingLogsRef.current = []
        setPendingLogCount(0)
        setLogs((current) => [...current, ...buffered].slice(-MAX_LOGS))
      }
      return next
    })
  }, [])

  const clearLogs = useCallback(() => {
    pendingLogsRef.current = []
    setPendingLogCount(0)
    setLogs([
      {
        id: ++logSequence,
        time: timestamp(),
        tag: 'SYSTEM',
        level: 'info',
        message: 'Audit buffer cleared · listening for cluster events',
      },
    ])
  }, [])

  const uptimeSeconds = Math.floor((now - startedAtRef.current) / 1000)

  return {
    mode,
    setMode: setModeSafe,
    autoFallback,
    gatewayUp,
    coordinatorUp,
    chaosAgent,
    replicas,
    counters,
    maxCounter,
    lastServiced,
    balanceResult,
    balanceBusy,
    balances,
    liquidity,
    liquidityReady,
    conservationDelta,
    sampledCount: sampledValues.length,
    healthyCount,
    desiredReplicaCount: DESIRED_REPLICA_COUNT,
    shardHealth,
    p95,
    latencies,
    routedRequests,
    transferCount,
    settledCount,
    tx,
    transferBusy,
    recovery,
    healing,
    chaosBusy,
    logs,
    logsPaused,
    pendingLogCount,
    toasts,
    now,
    uptimeSeconds,
    actions: {
      runBalance,
      runTransfer,
      runCrashDemo,
      stopReplica,
      triggerSelfHealing,
      restartReplica,
      restoreCluster,
      restartCoordinator,
      toggleLogsPause,
      clearLogs,
      dismissToast,
      refreshLiquidity,
    },
  }
}
