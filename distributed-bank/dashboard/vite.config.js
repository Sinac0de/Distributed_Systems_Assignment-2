import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const GATEWAY_TARGET = process.env.VITE_GATEWAY_URL || 'http://localhost:8080'
const COORDINATOR_TARGET = process.env.VITE_COORDINATOR_URL || 'http://localhost:8005'

const ALLOWED_CONTAINERS = new Set([
  'bank-server-a1',
  'bank-server-a2',
  'bank-server-b1',
  'bank-server-b2',
  'coordinator',
])

const RESTORE_ORDER = [
  'bank-server-a1',
  'bank-server-a2',
  'bank-server-b1',
  'bank-server-b2',
  'coordinator',
]

async function docker(args, timeout = 20000) {
  const { stdout, stderr } = await exec('docker', args, {
    timeout,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  return `${stdout || ''}${stderr || ''}`.trim()
}

function shortError(error) {
  return String(error?.stderr || error?.message || error).split('\n')[0].slice(0, 300)
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) reject(new Error('Request body too large'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Tiny local control agent for the demo buttons.
 * Uses the host Docker CLI so the browser can stop/start containers without
 * adding another backend service. Falls back gracefully in the UI when the
 * Docker engine (or the dev server middleware) is unavailable.
 */
function chaosAgent() {
  const handler = async (req, res) => {
    const path = (req.url || '/').split('?')[0].replace(/\/$/, '') || '/'

    try {
      if (req.method === 'GET' && path === '/status') {
        try {
          const version = await docker(['version', '--format', '{{.Server.Version}}'], 5000)
          return sendJson(res, 200, { available: true, engine: 'docker', version })
        } catch (error) {
          return sendJson(res, 200, { available: false, error: shortError(error) })
        }
      }

      if (req.method === 'GET' && path === '/last-tx') {
        try {
          const logs = await docker(['logs', '--tail', '250', 'coordinator'], 8000)
          const matches = logs.match(/tx_[0-9a-f]{12}/g)
          return sendJson(res, 200, { tx_id: matches ? matches[matches.length - 1] : null })
        } catch (error) {
          return sendJson(res, 200, { tx_id: null, error: shortError(error) })
        }
      }

      if (req.method === 'POST' && path === '/action') {
        const body = await readBody(req)
        const { action, container } = body || {}

        if (action === 'restore') {
          const results = []
          for (const name of RESTORE_ORDER) {
            try {
              await docker(['start', name], 20000)
              results.push({ name, ok: true })
            } catch (error) {
              results.push({ name, ok: false, error: shortError(error) })
            }
          }
          return sendJson(res, 200, {
            ok: results.some((r) => r.ok),
            results,
          })
        }

        if (!ALLOWED_CONTAINERS.has(container)) {
          return sendJson(res, 400, { ok: false, error: `Container not allowed: ${container}` })
        }
        if (!['stop', 'start', 'restart'].includes(action)) {
          return sendJson(res, 400, { ok: false, error: `Unsupported action: ${action}` })
        }

        const args =
          action === 'stop'
            ? ['stop', '-t', '1', container]
            : action === 'start'
              ? ['start', container]
              : ['restart', '-t', '1', container]

        const output = await docker(args, 20000)
        return sendJson(res, 200, { ok: true, action, container, output })
      }

      return sendJson(res, 404, { ok: false, error: 'Unknown chaos endpoint' })
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: shortError(error) })
    }
  }

  return {
    name: 'banking-chaos-agent',
    configureServer(server) {
      server.middlewares.use('/api/chaos', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/chaos', handler)
    },
  }
}

const proxy = {
  '/api/gateway': {
    target: GATEWAY_TARGET,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
  },
  '/api/coordinator': {
    target: COORDINATOR_TARGET,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/coordinator/, ''),
  },
}

export default defineConfig({
  plugins: [react(), chaosAgent()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
})
