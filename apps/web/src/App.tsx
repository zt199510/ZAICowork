import { useEffect, useMemo, useRef, useState } from 'react'
import type { BridgeState, RunState, StreamEvent } from '@aiide/shared-protocol'
import { ChatHeader } from './components/chat/ChatHeader'
import { MessageTimeline } from './components/chat/MessageTimeline'
import { PromptComposer } from './components/chat/PromptComposer'
import { AppSidebar } from './components/layout/AppSidebar'
import { ActivityBar } from './components/layout/ActivityBar'
import { PrimarySidebar } from './components/layout/PrimarySidebar'
import { BottomPanel } from './components/layout/BottomPanel'
import { AuxiliarySidebar } from './components/layout/AuxiliarySidebar'
import { PanelsTopLeft, LayoutPanelLeft, LayoutPanelTop, PanelsRightBottom } from 'lucide-react'
import { startAgentRun, subscribeBridgeHealth, type AgentLogEntry, type AgentRunController } from './lib/agentClient'
import type {
  EventPreview,
  Message,
  PrimaryView,
  BottomPanelTab,
  AuxiliaryPanelTab,
  Session,
  TimelineItem,
  ToolCallEntry,
  WorkMode,
} from './types/workbench'
import './App.css'

type SessionRecord = Session & {
  messages: Message[]
  toolCalls: Map<string, ToolCallEntry>
  timeline: TimelineItem[]
  draft: string
}

const initialSessionRecords: SessionRecord[] = [
  {
    id: 's-1',
    title: '重构登录流程',
    updatedAt: '2 分钟前',
    summary: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
    draft: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-1',
        role: 'user',
        content: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
      },
      {
        id: 'm-2',
        role: 'assistant',
        content:
          '收到。我会先输出迁移计划，再逐步改动文件并在每一步给出差异说明，最后执行 lint 与构建验证。',
      },
    ],
  },
  {
    id: 's-2',
    title: '实现 MCP 工具桥接',
    updatedAt: '15 分钟前',
    summary: '为前端增加工具调用状态和事件透出，并保持 SSE 协议清晰可调试。',
    draft: '',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-3',
        role: 'user',
        content: '请为前端补齐工具调用开始/完成状态，并在右侧展示日志与流事件。',
      },
      {
        id: 'm-4',
        role: 'assistant',
        content: '可以，建议先把事件、日志和计划拆成独立面板，再把桥接状态接进去。',
      },
    ],
  },
  {
    id: 's-3',
    title: '修复 CI lint 失败',
    updatedAt: '昨天',
    summary: '定位 lint 失败根因，优先修复严格类型和无用变量问题。',
    draft: '',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-5',
        role: 'user',
        content: '请先分析 lint 错误来源，再给出最小改动的修复方案。',
      },
      {
        id: 'm-6',
        role: 'assistant',
        content: '会先确认报错集中在哪些文件，再避免顺手修改不相关代码。',
      },
    ],
  },
]

const statusLabel: Record<RunState, string> = {
  idle: '空闲',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
}

const planStepsByView: Record<PrimaryView, string[]> = {
  chat: ['分析代码与依赖关系', '提出最小修改方案', '应用补丁并运行验证', '输出变更摘要与后续建议'],
  tasks: ['定义阶段与负责人', '映射审批节点', '接入运行回放', '补齐结果验收'],
  resources: ['建立资源分组', '设计过滤与检索', '加入最近访问', '承接详情预览'],
  skills: ['梳理能力分区', '整理模板清单', '加入启用状态', '预留复制与应用动作'],
  settings: ['建立设置分组', '统一 token 与主题', '补齐运行策略项', '加入保存与回滚反馈'],
}

const inspectorCopy: Record<PrimaryView, { title: string; description: string }> = {
  chat: {
    title: 'Execution Console',
    description: '当前会话的计划、日志和流事件会在这里聚合展示。',
  },
  tasks: {
    title: 'Task Inspector',
    description: '用于跟踪阶段计划、审批节点和回放结构。',
  },
  resources: {
    title: 'Resource Inspector',
    description: '用于整理资源分组、检索入口与详情视图。',
  },
  skills: {
    title: 'Skill Inspector',
    description: '用于承接技能模板、约束和快捷提示的配置。',
  },
  settings: {
    title: 'Settings Inspector',
    description: '用于统一主题、布局密度和运行策略相关选项。',
  },
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
  }
}

const summarizePrompt = (prompt: string) => {
  const normalized = prompt.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return '新会话'
  }

  return normalized.length > 22 ? `${normalized.slice(0, 22)}...` : normalized
}

function App() {
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>(initialSessionRecords)
  const [activeSessionId, setActiveSessionId] = useState(initialSessionRecords[0]?.id ?? '')
  const [activeActivity, setActiveActivity] = useState<PrimaryView>('chat')
  const [workMode, setWorkMode] = useState<WorkMode>('code')
  
  // Shell State
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240)
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true)
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>('logs')
  const [auxiliaryPanelWidth, setAuxiliaryPanelWidth] = useState(300)
  const [isAuxiliaryPanelOpen, setIsAuxiliaryPanelOpen] = useState(false)
  const [activeAuxiliaryTab, setActiveAuxiliaryTab] = useState<AuxiliaryPanelTab>('details')

  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingBottom, setIsResizingBottom] = useState(false)

  const [events, setEvents] = useState<StreamEvent[]>([])
  const [logs, setLogs] = useState<AgentLogEntry[]>([])
  const [runState, setRunState] = useState<RunState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [bashConfirmCommands, setBashConfirmCommands] = useState<string[] | null>(null)
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null)
  const controllerRef = useRef<AgentRunController | null>(null)
  const runSessionMapRef = useRef<Map<string, string>>(new Map())
  const messageListRef = useRef<HTMLDivElement | null>(null)

  const activeSession = useMemo(
    () => sessionRecords.find((session) => session.id === activeSessionId) ?? sessionRecords[0] ?? null,
    [activeSessionId, sessionRecords],
  )

  const prompt = useMemo(() => activeSession?.draft ?? '', [activeSession])
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession])
  const timeline = useMemo(() => activeSession?.timeline ?? [], [activeSession])

  const inspectorEvents = useMemo<EventPreview[]>(
    () =>
      events.map((event, index) => ({
        id: `${event.runId}-${event.timestamp}-${event.type}-${index}`,
        type: event.type,
        summary: eventSummary(event),
      })),
    [events],
  )

  useEffect(() => {
    if (activeActivity !== 'chat') {
      return
    }

    const messageList = messageListRef.current
    if (!messageList) {
      return
    }

    messageList.scrollTop = messageList.scrollHeight
  }, [activeActivity, messages, timeline])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        setLeftSidebarWidth(Math.max(170, Math.min(600, e.clientX - 48))) // 48 is Activity Bar width
      } else if (isResizingBottom) {
        setBottomPanelHeight(Math.max(100, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY)))
      }
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      setIsResizingBottom(false)
    }

    if (isResizingSidebar || isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize'
    } else {
      document.body.style.cursor = 'default'
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, isResizingBottom])

  useEffect(
    () => () => {
      void controllerRef.current?.cancel().catch(() => undefined)
    },
    [],
  )

  useEffect(() => {
    const unsubscribe = subscribeBridgeHealth(setBridgeState)
    return () => { unsubscribe?.() }
  }, [])

  const updateSessionRecord = (sessionId: string, updater: (session: SessionRecord) => SessionRecord) => {
    setSessionRecords((currentSessions) =>
      currentSessions.map((session) => (session.id === sessionId ? updater(session) : session)),
    )
  }

  const appendLog = (entry: AgentLogEntry) => {
    setLogs((currentLogs) => [entry, ...currentLogs].slice(0, 24))
  }

  const appendAssistantText = (runId: string, text: string) => {
    const sessionId = runSessionMapRef.current.get(runId)

    if (!sessionId) {
      return
    }

    updateSessionRecord(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.runId === runId ? { ...message, content: `${message.content}${text}` } : message,
      ),
    }))
  }

  const appendAssistantFallback = (runId: string, text: string) => {
    const sessionId = runSessionMapRef.current.get(runId)

    if (!sessionId) {
      return
    }

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
    setEvents((currentEvents) => [event, ...currentEvents].slice(0, 24))

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

  const handlePromptChange = (value: string) => {
    if (!activeSession) {
      return
    }

    updateSessionRecord(activeSession.id, (session) => ({
      ...session,
      draft: value,
    }))
  }

  const handleSelectActivity = (activity: PrimaryView) => {
    if (activity === activeActivity) {
      setIsLeftSidebarOpen(!isLeftSidebarOpen)
    } else {
      setActiveActivity(activity)
      setIsLeftSidebarOpen(true)
    }

    if (activity === 'chat' && !activeSessionId && sessionRecords[0]) {
      setActiveSessionId(sessionRecords[0].id)
    }
  }

  const handleCreateSession = () => {
    const sessionId = crypto.randomUUID()

    setSessionRecords((currentSessions) => [
      {
        id: sessionId,
        title: '新会话',
        updatedAt: '刚刚',
        summary: '等待任务目标',
        draft: '',
        messages: [],
        toolCalls: new Map(),
        timeline: [],
      },
      ...currentSessions,
    ])
    setActiveSessionId(sessionId)
    setActiveActivity('chat')
    setErrorMessage(null)
    setIsLeftSidebarOpen(true)
  }

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setActiveActivity('chat')
    setErrorMessage(null)
  }

  const executeRun = (trimmedPrompt: string) => {
    if (!activeSession) {
      return
    }

    const sessionId = activeSession.id
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
    setRunState('running')
    setErrorMessage(null)
    setEvents([])
    setLogs([])

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
      setActiveRunId((currentRunId) => (currentRunId === controller.runId ? null : currentRunId))
    })
  }

  const handleSubmit = () => {
    if (!activeSession) {
      return
    }

    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || runState === 'running') {
      return
    }

    // Detect bash: lines and require confirmation
    const bashLines = trimmedPrompt
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^bash:/i.test(l))
      .map((l) => l.replace(/^bash:\s*/i, ''))

    if (bashLines.length > 0) {
      setBashConfirmCommands(bashLines)
      return
    }

    executeRun(trimmedPrompt)
  }

  const handleBashConfirm = () => {
    setBashConfirmCommands(null)
    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt) {
      executeRun(trimmedPrompt)
    }
  }

  const handleBashCancel = () => {
    setBashConfirmCommands(null)
  }

  const handleCancel = () => {
    void controllerRef.current?.cancel().catch((error: Error) => {
      setRunState('failed')
      setErrorMessage(error.message)
    })
  }

  const activeActivityTitle = activeActivity === 'chat' ? activeSession?.title ?? 'New Session' : moduleSidebarContent[activeActivity].title

  return (
    <div className="workbench-shell">
      <ActivityBar activeActivity={activeActivity} onSelectActivity={handleSelectActivity} />

      <main className="workbench-main">
        {isLeftSidebarOpen && (
          <>
            <PrimarySidebar
              activeActivity={activeActivity}
              sessions={sessionRecords}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={handleCreateSession}
              width={leftSidebarWidth}
            />
            <div 
              className={`sidebar-resizer ${isResizingSidebar ? 'is-active' : ''}`} 
              onMouseDown={() => setIsResizingSidebar(true)}
            />
          </>
        )}

        <div className="workspace-center">
          <section className="workspace-body">
            {activeActivity === 'chat' ? (
              <>
                <ChatHeader
                  title={activeSession?.title ?? 'New Session'}
                  summary={activeSession?.summary ?? 'Provide mission goals to start.'}
                  runState={runState}
                  statusText={statusLabel[runState]}
                  workMode={workMode}
                  bridgeState={bridgeState}
                  onWorkModeChange={setWorkMode}
                />

                {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

                {bashConfirmCommands ? (
                  <div className="bash-confirm-overlay">
                    <div className="bash-confirm-dialog">
                      <h3 className="bash-confirm-dialog__title">Confirm Shell Execution</h3>
                      <p className="bash-confirm-dialog__desc">The following commands will run locally:</p>
                      <ul className="bash-confirm-dialog__list">
                        {bashConfirmCommands.map((cmd, i) => (
                          <li key={i}><code>{cmd}</code></li>
                        ))}
                      </ul>
                      <div className="bash-confirm-dialog__actions">
                        <button type="button" className="button button--ghost" onClick={handleBashCancel}>Cancel</button>
                        <button type="button" className="button button--primary" onClick={handleBashConfirm}>Execute</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <MessageTimeline ref={messageListRef} messages={messages} timeline={timeline} />

                <PromptComposer
                  prompt={prompt}
                  workMode={workMode}
                  disabled={runState === 'running'}
                  canCancel={runState === 'running' && !!activeRunId}
                  onPromptChange={handlePromptChange}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                />
              </>
            ) : (
              <ModulePage view={activeActivity} />
            )}
          </section>

          {isBottomPanelOpen && (
            <>
              <div 
                className={`bottom-resizer ${isResizingBottom ? 'is-active' : ''}`} 
                onMouseDown={() => setIsResizingBottom(true)}
              />
              <BottomPanel
                activeTab={activeBottomTab}
                onSelectTab={setActiveBottomTab}
                onClose={() => setIsBottomPanelOpen(false)}
                height={bottomPanelHeight}
                planSteps={planStepsByView[activeActivity]}
                logs={logs}
                events={inspectorEvents}
              />
            </>
          )}
        </div>

        {isAuxiliaryPanelOpen && (
          <AuxiliarySidebar
            activeTab={activeAuxiliaryTab}
            onSelectTab={setActiveAuxiliaryTab}
            onClose={() => setIsAuxiliaryPanelOpen(false)}
            width={auxiliaryPanelWidth}
          />
        )}
      </main>
    </div>
  )
}

export default App
