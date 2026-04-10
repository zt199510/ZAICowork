import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Activity, ListTodo, Logs, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { RunState } from '@aiide/shared-protocol'
import type { AgentLogEntry } from '../../lib/agentClient'
import type { EventPreview, PrimaryView, RightPanelTab } from '../../types/workbench'

type RightPanelProps = {
  activeView: PrimaryView
  activeTab: RightPanelTab
  description: string
  events: EventPreview[]
  isOpen: boolean
  logs: AgentLogEntry[]
  onSelectTab: (tab: RightPanelTab) => void
  onToggle: (nextOpen: boolean) => void
  onWidthChange: (width: number) => void
  planSteps: string[]
  runState: RunState
  statusText: string
  title: string
  width: number
}

const MIN_PANEL_WIDTH = 300
const MAX_PANEL_WIDTH = 460
const RAIL_WIDTH = 52

const tabs: Array<{ value: RightPanelTab; label: string; icon: typeof ListTodo }> = [
  { value: 'plan', label: '计划', icon: ListTodo },
  { value: 'logs', label: '日志', icon: Logs },
  { value: 'events', label: '事件', icon: Activity },
]

const clampPanelWidth = (width: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width))

export function RightPanel({
  activeView,
  activeTab,
  description,
  events,
  isOpen,
  logs,
  onSelectTab,
  onToggle,
  onWidthChange,
  planSteps,
  runState,
  statusText,
  title,
  width,
}: RightPanelProps) {
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current) {
        return
      }

      const delta = startXRef.current - event.clientX
      onWidthChange(clampPanelWidth(startWidthRef.current + delta))
    }

    const handleMouseUp = () => {
      draggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onWidthChange])

  const tabLabel = useMemo(
    () => tabs.find((tab) => tab.value === activeTab)?.label ?? '计划',
    [activeTab],
  )

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isOpen) {
      return
    }

    event.preventDefault()
    draggingRef.current = true
    startXRef.current = event.clientX
    startWidthRef.current = width
    setIsDragging(true)
  }

  const renderPlan = () => (
    <div className="right-panel__stack">
      <ol className="plan-list">
        {planSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="inspector-note">
        <p className="inspector-note__label">观察点</p>
        <p>
          {activeView === 'chat'
            ? '首轮重点是把工作台骨架稳定下来，再逐步承接更多执行产物。'
            : '当前模块先交付可导航、可扩展的页面骨架，功能细化会在下一轮补齐。'}
        </p>
      </div>
    </div>
  )

  const renderLogs = () => (
    <div className="right-panel__stack">
      {logs.length === 0 ? <p className="panel-empty">等待本地 bridge 日志...</p> : null}
      {logs.map((log) => (
        <article key={log.id} className={`panel-card panel-card--log panel-card--${log.level}`}>
          <p className="panel-card__eyebrow">{new Date(log.timestamp).toLocaleTimeString()}</p>
          <p className="panel-card__content">{log.message}</p>
        </article>
      ))}
    </div>
  )

  const renderEvents = () => (
    <div className="right-panel__stack">
      {events.length === 0 ? <p className="panel-empty">尚未收到事件。</p> : null}
      {events.map((event) => (
        <article key={event.id} className="panel-card">
          <p className="panel-card__eyebrow">{event.type}</p>
          <p className="panel-card__content">{event.summary}</p>
        </article>
      ))}
    </div>
  )

  return (
    <aside
      className={`right-panel-shell ${isOpen ? 'is-open' : 'is-collapsed'}`}
      style={{ width: isOpen ? width : RAIL_WIDTH }}
      aria-label="右侧检查面板"
    >
      <div className={`right-panel__resizer ${isOpen ? '' : 'is-hidden'}`} onMouseDown={startResize} />

      <div className="right-panel__rail">
        {tabs.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.value}
              type="button"
              className={`right-panel__rail-button ${activeTab === tab.value ? 'is-active' : ''}`}
              onClick={() => {
                onSelectTab(tab.value)
                if (!isOpen) {
                  onToggle(true)
                }
              }}
              aria-label={tab.label}
              title={tab.label}
            >
              <Icon className="right-panel__rail-icon" />
            </button>
          )
        })}

        <div className="right-panel__rail-spacer" />

        <button
          type="button"
          className="right-panel__rail-button"
          onClick={() => onToggle(!isOpen)}
          aria-label={isOpen ? '折叠检查面板' : '展开检查面板'}
          title={isOpen ? '折叠' : '展开'}
        >
          {isOpen ? (
            <PanelRightClose className="right-panel__rail-icon" />
          ) : (
            <PanelRightOpen className="right-panel__rail-icon" />
          )}
        </button>
      </div>

      <div className="right-panel__content">
        <header className="right-panel__header">
          <div>
            <p className="section-kicker">Inspector / {tabLabel}</p>
            <h2 className="right-panel__title">{title}</h2>
            <p className="right-panel__description">{description}</p>
          </div>

          <div className={`status-pill status-pill--${runState}`}>{statusText}</div>
        </header>

        <div className="right-panel__body">
          {activeTab === 'plan' ? renderPlan() : null}
          {activeTab === 'logs' ? renderLogs() : null}
          {activeTab === 'events' ? renderEvents() : null}
        </div>
      </div>
    </aside>
  )
}