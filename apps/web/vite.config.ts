import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { AgentRpcEvent, AgentRpcRequest, StreamEvent } from '@aiide/shared-protocol'

type RunRecord = {
  runId: string
  clients: Set<ServerResponse<IncomingMessage>>
  child?: ChildProcessWithoutNullStreams
  events: StreamEvent[]
  terminal: boolean
  canceled: boolean
  cleanupTimer?: ReturnType<typeof setTimeout>
}

const agentProjectPath = fileURLToPath(
  new URL('../../services/agent-dotnet/src/AIIde.Agent/AIIde.Agent.csproj', import.meta.url),
)

const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

function localAgentBridge() {
  const runs = new Map<string, RunRecord>()

  const ensureRun = (runId: string) => {
    const existing = runs.get(runId)
    if (existing) {
      return existing
    }

    const nextRun: RunRecord = {
      runId,
      clients: new Set<ServerResponse<IncomingMessage>>(),
      events: [],
      terminal: false,
      canceled: false,
    }

    runs.set(runId, nextRun)
    return nextRun
  }

  const sendJson = (
    response: ServerResponse<IncomingMessage>,
    statusCode: number,
    payload: Record<string, unknown>,
  ) => {
    response.statusCode = statusCode
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(payload))
  }

  const sendSseEvent = (response: ServerResponse<IncomingMessage>, event: StreamEvent) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const broadcast = (run: RunRecord, event: StreamEvent) => {
    run.events.push(event)

    for (const client of run.clients) {
      sendSseEvent(client, event)
    }

    if (isTerminalEvent(event)) {
      run.terminal = true
      closeClients(run)
      scheduleCleanup(run)
    }
  }

  const scheduleCleanup = (run: RunRecord) => {
    if (run.cleanupTimer) {
      clearTimeout(run.cleanupTimer)
    }

    run.cleanupTimer = setTimeout(() => {
      runs.delete(run.runId)
    }, 30_000)
  }

  const closeClients = (run: RunRecord) => {
    for (const client of run.clients) {
      client.end()
    }

    run.clients.clear()
  }

  const createStatusEvent = (
    runId: string,
    state: 'running' | 'completed' | 'failed' | 'canceled',
    message: string,
  ): StreamEvent => ({
    type: 'status',
    runId,
    timestamp: new Date().toISOString(),
    payload: { state, message },
  })

  const createErrorEvent = (runId: string, message: string, retriable = true): StreamEvent => ({
    type: 'error',
    runId,
    timestamp: new Date().toISOString(),
    payload: {
      code: 'bridge_error',
      message,
      retriable,
    },
  })

  const isTerminalEvent = (event: StreamEvent) =>
    event.type === 'run_completed' ||
    event.type === 'error' ||
    (event.type === 'status' &&
      (event.payload.state === 'canceled' || event.payload.state === 'failed'))

  const readJsonBody = async (request: IncomingMessage) => {
    const chunks: Uint8Array[] = []

    for await (const chunk of request) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }

    const body = Buffer.concat(chunks).toString('utf8')
    return JSON.parse(body) as AgentRpcRequest
  }

  const startRun = (request: AgentRpcRequest, response: ServerResponse<IncomingMessage>) => {
    if (request.method !== 'agent.run') {
      sendJson(response, 400, { error: 'Unsupported method.' })
      return
    }

    const run = ensureRun(request.params.runId)

    if (run.child) {
      sendJson(response, 409, { error: 'Run already started.' })
      return
    }

    const child = spawn('dotnet', ['run', '--project', agentProjectPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: monorepoRoot,
    })

    run.child = child
    run.terminal = false
    run.canceled = false
    broadcast(run, createStatusEvent(run.runId, 'running', 'Local bridge started agent process.'))

    const stdout = createInterface({ input: child.stdout })
    const stderr = createInterface({ input: child.stderr })

    stdout.on('line', (line: string) => {
      if (!line.trim()) {
        return
      }

      try {
        const rpcEvent = JSON.parse(line) as AgentRpcEvent
        broadcast(run, rpcEvent.params)
      } catch {
        broadcast(run, createErrorEvent(run.runId, 'Failed to parse agent stdout event.', false))
      }
    })

    stderr.on('line', (line: string) => {
      if (!line.trim() || run.terminal) {
        return
      }

      broadcast(run, createStatusEvent(run.runId, 'running', `agent stderr: ${line}`))
    })

    child.on('error', (error: Error) => {
      if (run.terminal) {
        return
      }

      broadcast(run, createErrorEvent(run.runId, error.message, true))
    })

    child.on('exit', (code: number | null) => {
      run.child = undefined

      if (run.canceled) {
        run.terminal = true
        closeClients(run)
        scheduleCleanup(run)
        return
      }

      if (!run.terminal && code !== 0) {
        broadcast(run, createErrorEvent(run.runId, `Agent process exited with code ${code ?? 'unknown'}.`, true))
        return
      }

      if (!run.terminal) {
        broadcast(run, createStatusEvent(run.runId, 'completed', 'Agent process exited cleanly.'))
        run.terminal = true
        closeClients(run)
        scheduleCleanup(run)
      }
    })

    child.stdin.write(`${JSON.stringify(request)}\n`)
    child.stdin.end()
    sendJson(response, 202, { ok: true, runId: run.runId })
  }

  const cancelRun = (runId: string, response: ServerResponse<IncomingMessage>) => {
    const run = runs.get(runId)

    if (!run) {
      sendJson(response, 404, { error: 'Run not found.' })
      return
    }

    run.canceled = true

    if (!run.terminal) {
      broadcast(run, createStatusEvent(run.runId, 'canceled', 'Run canceled by user.'))
    }

    run.child?.kill()
    run.child = undefined
    sendJson(response, 202, { ok: true, runId })
  }

  const attachEventStream = (runId: string, response: ServerResponse<IncomingMessage>) => {
    const run = ensureRun(runId)

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })

    response.write(': connected\n\n')

    for (const event of run.events) {
      sendSseEvent(response, event)
    }

    if (run.terminal) {
      response.end()
      return
    }

    run.clients.add(response)
    response.on('close', () => {
      run.clients.delete(response)
    })
  }

  return {
    name: 'local-agent-bridge',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse<IncomingMessage>, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ? new URL(request.url, 'http://localhost') : null

        if (!url) {
          next()
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/agent/run') {
          void readJsonBody(request)
            .then((body) => startRun(body, response))
            .catch((error: Error) => {
              sendJson(response, 400, { error: error.message || 'Invalid JSON request body.' })
            })
          return
        }

        if (request.method === 'GET' && url.pathname.startsWith('/api/agent/runs/') && url.pathname.endsWith('/events')) {
          const runId = url.pathname.slice('/api/agent/runs/'.length, -'/events'.length)
          attachEventStream(runId, response)
          return
        }

        if (request.method === 'DELETE' && url.pathname.startsWith('/api/agent/runs/')) {
          const runId = url.pathname.slice('/api/agent/runs/'.length)
          cancelRun(runId, response)
          return
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localAgentBridge()],
})
