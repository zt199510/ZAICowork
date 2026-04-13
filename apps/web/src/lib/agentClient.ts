import type {
  AgentRpcRequest,
  BridgeState,
  LogLevel,
  LogSource,
  StreamEvent,
} from '@aiide/shared-protocol'

export type AgentLogEntry = {
  id: string
  source: LogSource
  level: LogLevel
  message: string
  timestamp: string
}

export type AgentRunController = {
  runId: string
  done: Promise<void>
  cancel: () => Promise<void>
}

type StartAgentRunOptions = {
  prompt: string
  model: string
  systemPrompt?: string
  onEvent: (event: StreamEvent) => void
  onError: (message: string, runId?: string) => void
  onLog?: (entry: AgentLogEntry) => void
}

const createLogEntry = (
  message: string,
  level: LogLevel = 'info',
  source: LogSource = 'renderer',
): AgentLogEntry => ({
  id: crypto.randomUUID(),
  source,
  level,
  message,
  timestamp: new Date().toISOString(),
})

// ---------------------------------------------------------------------------
// Transport abstraction — allows Web (HTTP+SSE) and Electron (IPC) to share
// the same AgentRunController interface.
// ---------------------------------------------------------------------------

type ElectronAgentApi = {
  startRun: (request: AgentRpcRequest) => Promise<{ ok: boolean; runId: string }>
  cancelRun: (runId: string) => Promise<{ ok: boolean; runId: string }>
  onRunEvent: (runId: string, callback: (event: StreamEvent) => void) => () => void
  getBridgeState: () => Promise<BridgeState>
  onBridgeStateChange: (callback: (state: BridgeState) => void) => () => void
  debugCrashRun?: (runId: string) => Promise<{ ok: boolean; runId: string }>
}

declare global {
  interface Window {
    agentApi?: ElectronAgentApi
  }
}

function isTerminalEvent(event: StreamEvent): boolean {
  return (
    event.type === 'run_completed' ||
    event.type === 'error' ||
    (event.type === 'status' &&
      (event.payload.state === 'canceled' || event.payload.state === 'failed'))
  )
}

// ---------------------------------------------------------------------------
// Web transport (HTTP + SSE) — original implementation
// ---------------------------------------------------------------------------

function startAgentRunWeb(options: StartAgentRunOptions): AgentRunController {
  const runId = crypto.randomUUID()
  const requestId = crypto.randomUUID()

  let finished = false
  let eventSource: EventSource | null = null
  let resolveDone: () => void = () => {}

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const log = (message: string, level: LogLevel = 'info') => {
    options.onLog?.(createLogEntry(message, level))
  }

  const close = () => {
    eventSource?.close()
    eventSource = null
  }

  const finish = () => {
    if (finished) {
      return
    }

    finished = true
    close()
    resolveDone()
  }

  eventSource = new EventSource(`/api/agent/runs/${runId}/events`)

  eventSource.onopen = () => {
    log('已连接到本地 agent 事件流。')
  }

  eventSource.onmessage = (messageEvent) => {
    try {
      const event = JSON.parse(messageEvent.data) as StreamEvent
      options.onEvent(event)

      if (isTerminalEvent(event)) {
        finish()
      }
    } catch {
      options.onError('无法解析本地 agent 返回的事件。', runId)
      log('无法解析本地 agent 返回的事件。', 'error')
      finish()
    }
  }

  eventSource.onerror = () => {
    if (finished) {
      return
    }

    options.onError('本地 agent 事件流已中断。', runId)
    log('本地 agent 事件流已中断。', 'error')
    finish()
  }

  const request: AgentRpcRequest = {
    id: requestId,
    method: 'agent.run',
    params: {
      runId,
      prompt: options.prompt,
      model: options.model,
      systemPrompt: options.systemPrompt,
    },
  }

  void fetch('/api/agent/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
    .then(async (response) => {
      if (response.ok) {
        log(`agent.run 已提交，runId=${runId}`)
        return
      }

      const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error ?? `HTTP ${response.status}`)
    })
    .catch((error: Error) => {
      options.onError(error.message, runId)
      log(`agent.run 提交失败：${error.message}`, 'error')
      finish()
    })

  return {
    runId,
    done,
    cancel: async () => {
      if (finished) {
        return
      }

      log('正在发送取消请求。')

      const response = await fetch(`/api/agent/runs/${runId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
        const message = errorBody?.error ?? `HTTP ${response.status}`
        options.onError(message, runId)
        log(`取消请求失败：${message}`, 'error')
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Electron transport (IPC via preload bridge)
// ---------------------------------------------------------------------------

function startAgentRunElectron(options: StartAgentRunOptions): AgentRunController {
  const api = window.agentApi!
  const runId = crypto.randomUUID()
  const requestId = crypto.randomUUID()

  let finished = false
  let unsubscribe: (() => void) | null = null
  let resolveDone: () => void = () => {}

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const log = (message: string, level: LogLevel = 'info') => {
    options.onLog?.(createLogEntry(message, level))
  }

  const finish = () => {
    if (finished) return
    finished = true
    unsubscribe?.()
    unsubscribe = null
    resolveDone()
  }

  // Subscribe to events before starting the run so we don't miss any.
  unsubscribe = api.onRunEvent(runId, (event: StreamEvent) => {
    options.onEvent(event)

    if (isTerminalEvent(event)) {
      finish()
    }
  })
  log('已建立 IPC 运行事件订阅。')

  const request: AgentRpcRequest = {
    id: requestId,
    method: 'agent.run',
    params: {
      runId,
      prompt: options.prompt,
      model: options.model,
      systemPrompt: options.systemPrompt,
    },
  }

  void api.startRun(request)
    .then(() => {
      log(`agent.run 已提交（IPC），runId=${runId}`)
    })
    .catch((error: Error) => {
      options.onError(error.message, runId)
      log(`agent.run 提交失败（IPC）：${error.message}`, 'error')
      finish()
    })

  return {
    runId,
    done,
    cancel: async () => {
      if (finished) return
      log('正在发送取消请求（IPC）。')
      try {
        await api.cancelRun(runId)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        options.onError(message, runId)
        log(`取消请求失败（IPC）：${message}`, 'error')
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Bridge health — Electron only
// ---------------------------------------------------------------------------

export function subscribeBridgeHealth(
  onStateChange: (state: BridgeState) => void,
): (() => void) | null {
  if (!window.agentApi) return null
  const api = window.agentApi
  void api.getBridgeState().then(onStateChange)
  return api.onBridgeStateChange(onStateChange)
}

export function canDebugCrashElectronRun(): boolean {
  return import.meta.env.DEV && !!window.agentApi?.debugCrashRun
}

export async function debugCrashElectronRun(runId: string): Promise<void> {
  const debugCrashRun = window.agentApi?.debugCrashRun
  if (!debugCrashRun) {
    throw new Error('仅 Electron 开发态支持模拟崩溃。')
  }
  await debugCrashRun(runId)
}

// ---------------------------------------------------------------------------
// Public API — auto-detects transport
// ---------------------------------------------------------------------------

export function startAgentRun(options: StartAgentRunOptions): AgentRunController {
  if (window.agentApi) {
    return startAgentRunElectron(options)
  }
  return startAgentRunWeb(options)
}
