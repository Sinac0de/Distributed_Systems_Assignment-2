const GATEWAY = '/api/gateway'
const COORDINATOR = '/api/coordinator'
const CHAOS = '/api/chaos'

async function request(url, options = {}, timeout = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const started = performance.now()

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })

    const text = await response.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      const detail =
        (data && typeof data === 'object' && (data.detail || data.error || data.message)) ||
        (typeof data === 'string' && data) ||
        `HTTP ${response.status}`
      const message = typeof detail === 'string' ? detail : JSON.stringify(detail)
      const error = new Error(message.replace(/\s+/g, ' ').trim().slice(0, 260) || `HTTP ${response.status}`)
      error.status = response.status
      error.data = data
      throw error
    }

    return {
      data,
      latency: Math.round(performance.now() - started),
      status: response.status,
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${Math.round(timeout / 1000)}s`)
      timeoutError.timeout = true
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  gatewayHealth: () => request(`${GATEWAY}/health`, {}, 4000),
  coordinatorHealth: () => request(`${COORDINATOR}/health`, {}, 3000),
  getBalance: (accountId) =>
    request(`${GATEWAY}/accounts/${encodeURIComponent(accountId)}/balance`, {}, 5000),
  transfer: (payload) =>
    request(
      `${GATEWAY}/transfer`,
      { method: 'POST', body: JSON.stringify(payload) },
      12000,
    ),
  coordinatorTransfer: (payload) =>
    request(
      `${COORDINATOR}/transactions/execute`,
      { method: 'POST', body: JSON.stringify(payload) },
      15000,
    ),
  transactionStatus: (txId) =>
    request(`${GATEWAY}/transactions/${encodeURIComponent(txId)}/status`, {}, 5000),
  chaosStatus: () => request(`${CHAOS}/status`, {}, 3000),
  chaosAction: (action, container) =>
    request(
      `${CHAOS}/action`,
      { method: 'POST', body: JSON.stringify({ action, container }) },
      25000,
    ),
  restoreCluster: () =>
    request(`${CHAOS}/action`, { method: 'POST', body: JSON.stringify({ action: 'restore' }) }, 60000),
  lastCoordinatorTx: () => request(`${CHAOS}/last-tx`, {}, 6000),
}
