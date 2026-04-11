import { Activity, ListTodo, Logs, X } from 'lucide-react'
import type { BottomPanelTab } from '../../types/workbench'
import type { AgentLogEntry } from '../../lib/agentClient'
import type { EventPreview } from '../../types/workbench'

type BottomPanelProps = {
  activeTab: BottomPanelTab
  onSelectTab: (tab: BottomPanelTab) => void
  onClose: () => void
  height: number
  planSteps: string[]
  logs: AgentLogEntry[]
  events: EventPreview[]
}

const tabs: Array<{ value: BottomPanelTab; label: string; icon: typeof ListTodo }> = [
  { value: 'plan', label: 'PLAN', icon: ListTodo },
  { value: 'logs', label: 'OUTPUT', icon: Logs },
  { value: 'events', label: 'TIMELINE', icon: Activity },
]

export function BottomPanel({
  activeTab,
  onSelectTab,
  onClose,
  height,
  planSteps,
  logs,
  events,
}: BottomPanelProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'plan':
        return (
          <div className="bottom-panel__content-scroll">
            <ol className="plan-list">
              {planSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )
      case 'logs':
        return (
          <div className="bottom-panel__content-scroll bottom-panel__logs">
            {logs.length === 0 ? <p className="panel-empty">No output yet...</p> : null}
            {logs.map((log) => (
              <div key={log.id} className={`log-entry log-entry--${log.level}`}>
                <span className="log-entry__time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="log-entry__message">{log.message}</span>
              </div>
            ))}
          </div>
        )
      case 'events':
        return (
          <div className="bottom-panel__content-scroll">
            {events.length === 0 ? <p className="panel-empty">No events recorded.</p> : null}
            {events.map((event) => (
              <div key={event.id} className="event-entry">
                <span className="event-entry__type">{event.type.toUpperCase()}</span>
                <span className="event-entry__summary">{event.summary}</span>
              </div>
            ))}
          </div>
        )
    }
  }

  return (
    <section className="bottom-panel" style={{ height }}>
      <header className="bottom-panel__header">
        <div className="bottom-panel__tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                className={`bottom-panel__tab-btn ${activeTab === tab.value ? 'is-active' : ''}`}
                onClick={() => onSelectTab(tab.value)}
              >
                <Icon className="bottom-panel__tab-icon" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
        <div className="bottom-panel__actions">
          <button className="bottom-panel__close-btn" onClick={onClose} title="Close Panel">
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="bottom-panel__body">{renderContent()}</div>
    </section>
  )
}
