import type { AgentRpcRequest, StreamEvent } from '@aiide/shared-protocol'

export type AgentLogEntry = {
  id: string
  level: 'info' | 'error'
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

const createLogEntry = (message: string, level: AgentLogEntry['level'] = 'info'): AgentLogEntry => ({
  id: crypto.randomUUID(),
  level,
  message,
  timestamp: new Date().toISOString(),
})

const summarizeEvent = (event: StreamEvent) => {
  switch (event.type) {
    case 'run_started':
      return `run_started: model=${event.payload.model}`
    case 'token_delta':
      return `token_delta: ${event.payload.text}`
    case 'status':
      return `status: ${event.payload.state} - ${event.payload.message}`
    case 'run_completed':
      return `run_completed: ${event.payload.outputSummary}`
    case 'error':
      return `error: ${event.payload.message}`
    case 'tool_call_started':
      return `tool_call_started: ${event.payload.toolName}`
    case 'tool_call_completed':
      return `tool_call_completed: ${event.payload.resultPreview}`
  }
}

export function startAgentRun(options: StartAgentRunOptions): AgentRunController {
  const runId = crypto.randomUUID()
  const requestId = crypto.randomUUID()

  let finished = false
  let eventSource: EventSource | null = null
  let resolveDone: () => void = () => {}

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })

  const log = (message: string, level: AgentLogEntry['level'] = 'info') => {
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
      log(summarizeEvent(event), event.type === 'error' ? 'error' : 'info')

      if (
        event.type === 'run_completed' ||
        event.type === 'error' ||
        (event.type === 'status' &&
          (event.payload.state === 'canceled' || event.payload.state === 'failed'))
      ) {
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