import { useEffect, useMemo, useRef, useState } from 'react'
import type { BridgeState, RunState, StreamEvent } from '@aiide/shared-protocol'
import {
  canDebugCrashElectronRun,
  debugCrashElectronRun,
  startAgentRun,
  subscribeBridgeHealth,
  type AgentLogEntry,
  type AgentRunController,
} from '../lib/agentClient'
import type { EventPreview, ToolCallEntry } from '../types/workbench'
import type { SessionRecord } from './useSessionManager'

type UpdateSessionRecordFn = (sessionId: string, updater: (session: SessionRecord) => SessionRecord) => void

export const statusLabel: Record<RunState, string> = {
  idle: '空闲',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
}

const bridgeConnectingMessage = 'Agent bridge 正在初始化，请稍后重试。'
const bridgeReconnectingMessage = 'Agent bridge 正在重连，请等待恢复后再试。'
const bridgeFailedMessage = 'Agent bridge 不可用，请检查 dotnet 环境后重试。'

function getBridgeUnavailableMessage(bridgeState: BridgeState | null): string | null {
  if (!window.agentApi) return null

  switch (bridgeState) {
    case 'ready':
      return null
    case 'reconnecting':
      return bridgeReconnectingMessage
    case 'failed':
      return bridgeFailedMessage
    case 'idle':
    default:
      return bridgeConnectingMessage
  }
}

function isBridgeStatusMessage(message: string | null): boolean {
  return message === bridgeConnectingMessage ||
    message === bridgeReconnectingMessage ||
    message === bridgeFailedMessage
}

const eventSummary = (event: StreamEvent) => {
  switch (event.type) {
    case 'run_started':
      return `模型：${event.payload.model}`
    case 'token_delta':
      return event.payload.text
    case 'status':
      return `${statusLabel[event.payload.state]} · ${event.payload.message}`
    case 'run_completed':
      return event.payload.outputSummary
    case 'error':
      return event.payload.message
    case 'tool_call_started':
      return `${event.payload.toolName}: ${event.payload.inputSummary}`
    case 'tool_call_completed':
      return `${event.payload.toolName} ${event.payload.status}: ${event.payload.resultPreview} (${event.payload.durationMs}ms)`
    case 'log':
      return `[${event.payload.source}] ${event.payload.message}`
  }
}

function summarizePrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, ' ').trim()
  if (!normalized) return '新会话'
  return normalized.length > 22 ? `${normalized.slice(0, 22)}...` : normalized
}

function toLogEntry(event: Extract<StreamEvent, { type: 'log' }>): AgentLogEntry {
  return {
    id: crypto.randomUUID(),
    source: event.payload.source,
    level: event.payload.level,
    message: event.payload.message,
    timestamp: event.timestamp,
  }
}

export function useAgentRun(updateSessionRecord: UpdateSessionRecordFn) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [logs, setLogs] = useState<AgentLogEntry[]>([])
  const [runState, setRunState] = useState<RunState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [bashConfirmCommands, setBashConfirmCommands] = useState<string[] | null>(null)
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null)

  const controllerRef = useRef<AgentRunController | null>(null)
  const runSessionMapRef = useRef<Map<string, string>>(new Map())
  const pendingRunRef = useRef<{ prompt: string; sessionId: string } | null>(null)

  const inspectorEvents = useMemo<EventPreview[]>(
    () =>
      events.map((event, index) => ({
        id: `${event.runId}-${event.timestamp}-${event.type}-${index}`,
        type: event.type,
        summary: eventSummary(event),
      })),
    [events],
  )

  // Cleanup controller on unmount
  useEffect(
    () => () => {
      void controllerRef.current?.cancel().catch(() => undefined)
    },
    [],
  )

  // Subscribe to bridge health (Electron)
  useEffect(() => {
    const unsubscribe = subscribeBridgeHealth(setBridgeState)
    return () => { unsubscribe?.() }
  }, [])

  useEffect(() => {
    if (bridgeState === 'ready' && isBridgeStatusMessage(errorMessage)) {
      setErrorMessage(null)
    }
  }, [bridgeState, errorMessage])

  const appendLog = (entry: AgentLogEntry) => {
    setLogs((current) => [entry, ...current].slice(0, 24))
  }

  const appendAssistantText = (runId: string, text: string) => {
    const sessionId = runSessionMapRef.current.get(runId)
    if (!sessionId) return

    updateSessionRecord(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.runId === runId ? { ...message, content: `${message.content}${text}` } : message,
      ),
    }))
  }

  const appendAssistantFallback = (runId: string, text: string) => {
    const sessionId = runSessionMapRef.current.get(runId)
    if (!sessionId) return

    updateSessionRecord(sessionId, (session) => {
      const existingMessage = session.messages.find((message) => message.runId === runId)

      if (existingMessage) {
        return {
          ...session,
          messages: session.messages.map((message) =>
            message.runId === runId ? { ...message, content: message.content || text } : message,
          ),
        }
      }

      return {
        ...session,
        messages: [
          ...session.messages,
          {
            id: `assistant-${runId}`,
            role: 'assistant',
            content: text,
            runId,
          },
        ],
      }
    })
  }

  const handleStreamEvent = (event: StreamEvent) => {
    setEvents((current) => [event, ...current].slice(0, 24))

    switch (event.type) {
      case 'run_started':
        setRunState('running')
        setErrorMessage(null)
        break
      case 'token_delta':
        appendAssistantText(event.runId, event.payload.text)
        break
      case 'status':
        setRunState(event.payload.state)
        break
      case 'run_completed':
        setRunState('completed')
        appendAssistantFallback(event.runId, event.payload.outputSummary)
        break
      case 'error':
        setRunState('failed')
        setErrorMessage(event.payload.message)
        appendAssistantFallback(event.runId, `运行失败：${event.payload.message}`)
        break
      case 'log':
        appendLog(toLogEntry(event))
        break
      case 'tool_call_started': {
        const { callId, toolName, inputSummary } = event.payload
        const sessionId = runSessionMapRef.current.get(event.runId)
        if (!sessionId) break
        updateSessionRecord(sessionId, (session) => {
          const entry: ToolCallEntry = { callId, toolName, inputSummary, status: 'running' }
          const nextToolCalls = new Map(session.toolCalls)
          nextToolCalls.set(callId, entry)
          return {
            ...session,
            toolCalls: nextToolCalls,
            timeline: [...session.timeline, { kind: 'tool_call', data: entry }],
          }
        })
        break
      }
      case 'tool_call_completed': {
        const { callId, toolName, status, resultPreview, outputText, outputTruncated, durationMs, errorCode, retryHint } = event.payload
        const sessionIdCompleted = runSessionMapRef.current.get(event.runId)
        if (!sessionIdCompleted) break
        updateSessionRecord(sessionIdCompleted, (session) => {
          const entry: ToolCallEntry = {
            callId, toolName, inputSummary: session.toolCalls.get(callId)?.inputSummary ?? toolName,
            status, resultPreview, outputText, outputTruncated, durationMs, errorCode, retryHint,
          }
          const nextToolCalls = new Map(session.toolCalls)
          nextToolCalls.set(callId, entry)
          return {
            ...session,
            toolCalls: nextToolCalls,
            timeline: session.timeline.map((item) =>
              item.kind === 'tool_call' && item.data.callId === callId
                ? { ...item, data: entry }
                : item,
            ),
          }
        })
        break
      }
    }
  }

  const executeRun = (trimmedPrompt: string, sessionId: string) => {
    setEvents([])
    setLogs([])
    setRunState('running')
    setErrorMessage(null)

    const controller = startAgentRun({
      prompt: trimmedPrompt,
      model: 'gpt-5.4',
      onEvent: handleStreamEvent,
      onError: (message, failedRunId) => {
        setRunState('failed')
        setErrorMessage(message)
        if (failedRunId) {
          appendAssistantFallback(failedRunId, `运行失败：${message}`)
        }
      },
      onLog: appendLog,
    })

    runSessionMapRef.current.set(controller.runId, sessionId)
    controllerRef.current = controller
    setActiveRunId(controller.runId)

    updateSessionRecord(sessionId, (session) => ({
      ...session,
      title: session.title === '新会话' ? summarizePrompt(trimmedPrompt) : session.title,
      updatedAt: '刚刚',
      summary: trimmedPrompt,
      draft: '',
      toolCalls: new Map(),
      timeline: [],
      messages: [
        ...session.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmedPrompt,
        },
        {
          id: `assistant-${controller.runId}`,
          role: 'assistant',
          content: '',
          runId: controller.runId,
        },
      ],
    }))

    void controller.done.then(() => {
      if (controllerRef.current?.runId === controller.runId) {
        controllerRef.current = null
      }
      runSessionMapRef.current.delete(controller.runId)
      setActiveRunId((current) => (current === controller.runId ? null : current))
    })
  }

  const submitPrompt = (prompt: string, sessionId: string | undefined) => {
    if (!sessionId) return

    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || runState === 'running') return

    const bridgeUnavailableMessage = getBridgeUnavailableMessage(bridgeState)
    if (bridgeUnavailableMessage) {
      setErrorMessage(bridgeUnavailableMessage)
      return
    }

    const bashLines = trimmedPrompt
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^bash:/i.test(l))
      .map((l) => l.replace(/^bash:\s*/i, ''))

    if (bashLines.length > 0) {
      pendingRunRef.current = { prompt: trimmedPrompt, sessionId }
      setBashConfirmCommands(bashLines)
      return
    }

    executeRun(trimmedPrompt, sessionId)
  }

  const handleBashConfirm = () => {
    setBashConfirmCommands(null)
    const pending = pendingRunRef.current
    pendingRunRef.current = null
    if (!pending) return

    const bridgeUnavailableMessage = getBridgeUnavailableMessage(bridgeState)
    if (bridgeUnavailableMessage) {
      setErrorMessage(bridgeUnavailableMessage)
      return
    }

    executeRun(pending.prompt, pending.sessionId)
  }

  const handleBashCancel = () => {
    setBashConfirmCommands(null)
    pendingRunRef.current = null
  }

  const handleCancel = () => {
    void controllerRef.current?.cancel().catch((error: Error) => {
      setRunState('failed')
      setErrorMessage(error.message)
    })
  }

  const handleDebugCrash = () => {
    if (!activeRunId) return

    setErrorMessage(null)
    void debugCrashElectronRun(activeRunId).catch((error: Error) => {
      setErrorMessage(error.message)
    })
  }

  const submitBlockedReason = getBridgeUnavailableMessage(bridgeState)
  const canDebugCrash = import.meta.env.DEV &&
    runState === 'running' &&
    !!activeRunId &&
    canDebugCrashElectronRun()

  return {
    events,
    logs,
    runState,
    errorMessage,
    activeRunId,
    bashConfirmCommands,
    bridgeState,
    inspectorEvents,
    submitBlockedReason,
    canDebugCrash,
    submitPrompt,
    handleBashConfirm,
    handleBashCancel,
    handleCancel,
    handleDebugCrash,
    clearError: () => setErrorMessage(null),
  }
}
