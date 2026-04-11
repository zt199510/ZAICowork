import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { ModuleView, PrimaryView, Session } from '../../types/workbench'

type PrimarySidebarProps = {
  activeActivity: PrimaryView
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
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
      <aside className="primary-sidebar" aria-label="Module Navigation">
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
    <aside className="primary-sidebar" aria-label="Chat Sessions">
      <div className="primary-sidebar__header">
        <div className="primary-sidebar__title-row">
          <h2 className="primary-sidebar__title">CHAT</h2>
          <button type="button" className="sidebar-action-icon" onClick={onCreateSession} title="New Session">
            <Plus className="sidebar-action-icon__svg" />
          </button>
        </div>
      </div>

      <div className="primary-sidebar__search-container">
        <label className="primary-sidebar__search">
          <Search className="primary-sidebar__search-icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sessions..."
          />
        </label>
      </div>

      <div className="primary-sidebar__session-list">
        {filteredSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`primary-sidebar__session-item ${
              activeSessionId === session.id ? 'is-active' : ''
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="primary-sidebar__session-title-row">
              <span className="primary-sidebar__session-title">{session.title}</span>
              <span className="primary-sidebar__session-time">{session.updatedAt}</span>
            </div>
            <p className="primary-sidebar__session-summary">{session.summary}</p>
          </button>
        ))}

        {filteredSessions.length === 0 ? (
          <div className="primary-sidebar__empty">No matching sessions.</div>
        ) : null}
      </div>
    </aside>
  )
}