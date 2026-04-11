import { useEffect, useMemo, useState } from 'react'
import { FolderTree, PlugZap, Plus, Search, Sparkles, Workflow } from 'lucide-react'
import type { ModuleView, PrimaryView, Session } from '../../types/workbench'

type PrimarySidebarProps = {
  activeActivity: PrimaryView
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  width: number
}

const moduleSidebarContent: Record<ModuleView, { kicker: string; title: string; sections: Array<{ title: string; items: string[] }> }> = {
  tasks: {
    kicker: 'Delivery Console',
    title: 'Tasks',
    sections: [
      { title: 'Current View', items: ['Execution Queue', 'Approval Nodes', 'Playback History'] },
      { title: 'Priorities', items: ['Phase Planning', 'Tool Output Sync', 'Acceptance Status'] },
    ],
  },
  resources: {
    kicker: 'Knowledge Surface',
    title: 'Resources',
    sections: [
      { title: 'Content Types', items: ['Repository Docs', 'Execution Artifacts', 'External Links'] },
      { title: 'Next Steps', items: ['Search Entry', 'Filters', 'Recent Access'] },
    ],
  },
  skills: {
    kicker: 'Agent Toolkit',
    title: 'Skills & Prompts',
    sections: [
      { title: 'Capability Domains', items: ['Code Generation', 'Task Planning', 'Doc Creation'] },
      { title: 'Configurations', items: ['Prompt Templates', 'Run Constraints', 'Shortcuts'] },
    ],
  },
  settings: {
    kicker: 'System Preferences',
    title: 'Settings',
    sections: [
      { title: 'Interface', items: ['Theme Tokens', 'Density', 'Animations'] },
      { title: 'Runtime', items: ['Default Model', 'Approval Policy', 'Log Level'] },
    ],
  },
}

export function PrimarySidebar({
  activeActivity,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  width,
}: PrimarySidebarProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    setSearch('')
  }, [activeActivity])

  const filteredSessions = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    if (!normalized) {
      return sessions
    }

    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(normalized) ||
        session.summary.toLowerCase().includes(normalized),
    )
  }, [search, sessions])

  if (activeActivity !== 'chat') {
    const content = moduleSidebarContent[activeActivity]

    return (
      <aside className="primary-sidebar" aria-label="Module Navigation" style={{ width }}>
        <div className="primary-sidebar__header">
          <div>
            <p className="section-kicker">{content.kicker}</p>
            <h2 className="primary-sidebar__title">{content.title}</h2>
          </div>
        </div>

        {content.sections.map((section) => (
          <section key={section.title} className="primary-sidebar__group">
            <p className="primary-sidebar__group-label">{section.title}</p>
            <div className="primary-sidebar__list">
              {section.items.map((item) => (
                <button key={item} type="button" className="primary-sidebar__item">
                  {item}
                </button>
              ))}
            </div>
          </section>
        ))}
      </aside>
    )
  }

  return (
    <aside className="primary-sidebar" aria-label="Chat Sessions" style={{ width }}>
      <header className="primary-sidebar__header">
        <div className="primary-sidebar__title-row">
          <h2 className="primary-sidebar__title">
            {activeActivity === 'chat' ? 'SESSIONS' : activeActivity.toUpperCase()}
          </h2>
          <button
            type="button"
            className="sidebar-action-icon"
            onClick={onCreateSession}
            title="New Session"
            style={{ opacity: 0.6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <Plus size={14} />
          </button>
        </div>
      </header>

      <div className="primary-sidebar__search-container">
        <div className="primary-sidebar__search" style={{ display: 'flex', alignItems: 'center', background: 'var(--background-elevated)', border: '1px solid var(--border)', borderRadius: '2px', padding: '2px 8px' }}>
          <Search size={12} style={{ opacity: 0.5, marginRight: '6px' }} />
          <input
            type="text"
            style={{ fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--foreground)', outline: 'none', width: '100%', padding: '2px 0' }}
            placeholder="Filter sessions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="primary-sidebar__session-list" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${session.id === activeSessionId ? 'is-active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="session-item__icon">
              {session.status === 'running' ? (
                <Sparkles size={14} className="status-running" />
              ) : session.status === 'error' ? (
                <PlugZap size={14} className="status-error" />
              ) : (
                <FolderTree size={14} />
              )}
            </div>
            <div className="session-item__info">
              <div className="session-item__title">{session.title}</div>
              <div className="session-item__meta">
                {session.model} · {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 ? (
          <div className="primary-sidebar__empty" style={{ padding: '20px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
            No matching sessions.
          </div>
        ) : null}
      </div>
    </aside>
  )
}