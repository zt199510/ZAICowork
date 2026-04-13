import { useEffect, useRef, useState } from 'react'
import { ChatHeader } from './components/chat/ChatHeader'
import { MessageTimeline } from './components/chat/MessageTimeline'
import { PromptComposer } from './components/chat/PromptComposer'
import { ActivityBar } from './components/layout/ActivityBar'
import { PrimarySidebar } from './components/layout/PrimarySidebar'
import { BottomPanel } from './components/layout/BottomPanel'
import { AuxiliarySidebar } from './components/layout/AuxiliarySidebar'
import { ModulePage } from './components/layout/ModulePage'
import { useWorkbenchLayout } from './hooks/useWorkbenchLayout'
import { useSessionManager } from './hooks/useSessionManager'
import { useAgentRun, statusLabel } from './hooks/useAgentRun'
import { WorkbenchContext } from './contexts/WorkbenchContext'
import type { PrimaryView, WorkMode } from './types/workbench'
import './App.css'

const planStepsByView: Record<PrimaryView, string[]> = {
  chat: ['分析代码与依赖关系', '提出最小修改方案', '应用补丁并运行验证', '输出变更摘要与后续建议'],
  tasks: ['定义阶段与负责人', '映射审批节点', '接入运行回放', '补齐结果验收'],
  resources: ['建立资源分组', '设计过滤与检索', '加入最近访问', '承接详情预览'],
  skills: ['梳理能力分区', '整理模板清单', '加入启用状态', '预留复制与应用动作'],
  settings: ['建立设置分组', '统一 token 与主题', '补齐运行策略项', '加入保存与回滚反馈'],
}

function App() {
  const layout = useWorkbenchLayout()
  const sessions = useSessionManager()
  const agentRun = useAgentRun(sessions.updateSessionRecord)

  const [workMode, setWorkMode] = useState<WorkMode>('code')
  const messageListRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (layout.activeActivity !== 'chat') return
    const el = messageListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [layout.activeActivity, sessions.messages, sessions.timeline])

  // --- Cross-cutting handlers ---

  const handleSelectActivity = (activity: PrimaryView) => {
    if (activity === layout.activeActivity) {
      layout.setIsLeftSidebarOpen(!layout.isLeftSidebarOpen)
    } else {
      layout.setActiveActivity(activity)
      layout.setIsLeftSidebarOpen(true)
    }
    if (activity === 'chat' && !sessions.activeSessionId && sessions.sessionRecords[0]) {
      sessions.setActiveSessionId(sessions.sessionRecords[0].id)
    }
  }

  const handleCreateSession = () => {
    sessions.createSession()
    layout.setActiveActivity('chat')
    layout.setIsLeftSidebarOpen(true)
    agentRun.clearError()
  }

  const handleSelectSession = (sessionId: string) => {
    sessions.setActiveSessionId(sessionId)
    layout.setActiveActivity('chat')
    agentRun.clearError()
  }

  const handleSubmit = () => {
    agentRun.submitPrompt(sessions.prompt, sessions.activeSession?.id)
  }

  return (
    <WorkbenchContext.Provider value={{ layout, sessions, agentRun }}>
      <div className="workbench-shell">
        <ActivityBar activeActivity={layout.activeActivity} onSelectActivity={handleSelectActivity} />

        <main className="workbench-main">
          {layout.isLeftSidebarOpen && (
            <>
              <PrimarySidebar
                activeActivity={layout.activeActivity}
                sessions={sessions.sessionRecords}
                activeSessionId={sessions.activeSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                width={layout.leftSidebarWidth}
              />
              <div
                className={`sidebar-resizer ${layout.isResizingSidebar ? 'is-active' : ''}`}
                onMouseDown={layout.startResizeSidebar}
              />
            </>
          )}

          <div className="workspace-center">
            <section className="workspace-body">
              {layout.activeActivity === 'chat' ? (
                <>
                  <ChatHeader
                    title={sessions.activeSession?.title ?? 'New Session'}
                    summary={sessions.activeSession?.summary ?? 'Provide mission goals to start.'}
                    runState={agentRun.runState}
                    statusText={statusLabel[agentRun.runState]}
                    workMode={workMode}
                    bridgeState={agentRun.bridgeState}
                    onWorkModeChange={setWorkMode}
                  />

                  {agentRun.errorMessage ? <div className="error-banner">{agentRun.errorMessage}</div> : null}

                  {agentRun.bashConfirmCommands ? (
                    <div className="bash-confirm-overlay">
                      <div className="bash-confirm-dialog">
                        <h3 className="bash-confirm-dialog__title">Confirm Shell Execution</h3>
                        <p className="bash-confirm-dialog__desc">The following commands will run locally:</p>
                        <ul className="bash-confirm-dialog__list">
                          {agentRun.bashConfirmCommands.map((cmd, i) => (
                            <li key={i}><code>{cmd}</code></li>
                          ))}
                        </ul>
                        <div className="bash-confirm-dialog__actions">
                          <button type="button" className="button button--ghost" onClick={agentRun.handleBashCancel}>Cancel</button>
                          <button type="button" className="button button--primary" onClick={agentRun.handleBashConfirm}>Execute</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <MessageTimeline ref={messageListRef} messages={sessions.messages} timeline={sessions.timeline} />

                  <PromptComposer
                    prompt={sessions.prompt}
                    workMode={workMode}
                    inputDisabled={agentRun.runState === 'running'}
                    submitDisabled={agentRun.runState === 'running' || !!agentRun.submitBlockedReason}
                    submitBlockedReason={agentRun.submitBlockedReason}
                    canCancel={agentRun.runState === 'running' && !!agentRun.activeRunId}
                    canDebugCrash={agentRun.canDebugCrash}
                    onPromptChange={sessions.handlePromptChange}
                    onSubmit={handleSubmit}
                    onCancel={agentRun.handleCancel}
                    onDebugCrash={agentRun.handleDebugCrash}
                  />
                </>
              ) : (
                <ModulePage view={layout.activeActivity} />
              )}
            </section>

            {layout.isBottomPanelOpen && (
              <>
                <div
                  className={`bottom-resizer ${layout.isResizingBottom ? 'is-active' : ''}`}
                  onMouseDown={layout.startResizeBottom}
                />
                <BottomPanel
                  activeTab={layout.activeBottomTab}
                  onSelectTab={layout.setActiveBottomTab}
                  onClose={() => layout.setIsBottomPanelOpen(false)}
                  height={layout.bottomPanelHeight}
                  planSteps={planStepsByView[layout.activeActivity]}
                  logs={agentRun.logs}
                  events={agentRun.inspectorEvents}
                />
              </>
            )}
          </div>

          {layout.isAuxiliaryPanelOpen && (
            <AuxiliarySidebar
              activeTab={layout.activeAuxiliaryTab}
              onSelectTab={layout.setActiveAuxiliaryTab}
              onClose={() => layout.setIsAuxiliaryPanelOpen(false)}
              width={layout.auxiliaryPanelWidth}
            />
          )}
        </main>
      </div>
    </WorkbenchContext.Provider>
  )
}

export default App
