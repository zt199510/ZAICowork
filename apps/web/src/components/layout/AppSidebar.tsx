import { useEffect, useMemo, useState } from 'react'
import { FolderTree, PlugZap, Plus, Search, Sparkles, Workflow } from 'lucide-react'
import type { ModuleView, PrimaryView, Session } from '../../types/workbench'

type AppSidebarProps = {
  activeView: PrimaryView
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
}

const moduleSidebarContent: Record<ModuleView, { kicker: string; title: string; sections: Array<{ title: string; items: string[] }> }> = {
  tasks: {
    kicker: 'Delivery Console',
    title: '任务编排',
    sections: [
      { title: '当前视图', items: ['执行队列', '审批节点', '回放历史'] },
      { title: '优先事项', items: ['拆解阶段计划', '同步工具输出', '回填验收状态'] },
    ],
  },
  resources: {
    kicker: 'Knowledge Surface',
    title: '资源聚合',
    sections: [
      { title: '内容类型', items: ['仓库文档', '运行产物', '外部链接'] },
      { title: '下一步', items: ['增加搜索入口', '引入过滤器', '展示最近访问'] },
    ],
  },
  skills: {
    kicker: 'Agent Toolkit',
    title: '技能与提示',
    sections: [
      { title: '能力域', items: ['代码生成', '任务规划', '文档生成'] },
      { title: '配置项', items: ['提示模板', '运行约束', '快捷动作'] },
    ],
  },
  settings: {
    kicker: 'System Preferences',
    title: '工作台设置',
    sections: [
      { title: '界面层', items: ['主题令牌', '布局密度', '动画开关'] },
      { title: '运行层', items: ['默认模型', '审批策略', '日志级别'] },
    ],
  },
}

export function AppSidebar({
  activeView,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
}: AppSidebarProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    setSearch('')
  }, [activeView])

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

  if (activeView !== 'chat') {
    const content = moduleSidebarContent[activeView]

    return (
      <aside className="workspace-sidebar" aria-label="模块导航">
        <div className="workspace-sidebar__header">
          <div>
            <p className="section-kicker">{content.kicker}</p>
            <h2 className="workspace-sidebar__title">{content.title}</h2>
          </div>
          <button type="button" className="sidebar-action sidebar-action--ghost">
            <Sparkles className="sidebar-action__icon" />
            规划
          </button>
        </div>

        {content.sections.map((section) => (
          <section key={section.title} className="workspace-sidebar__group">
            <p className="workspace-sidebar__group-label">{section.title}</p>
            <div className="workspace-sidebar__ghost-list">
              {section.items.map((item) => (
                <button key={item} type="button" className="workspace-sidebar__ghost-item">
                  {item}
                </button>
              ))}
            </div>
          </section>
        ))}

        <div className="sidebar-context-card sidebar-context-card--stacked">
          <p className="sidebar-context-card__eyebrow">工作区映射</p>
          <ul className="sidebar-context-list">
            <li>
              <FolderTree className="sidebar-context-list__icon" />
              <span>apps/web</span>
            </li>
            <li>
              <Workflow className="sidebar-context-list__icon" />
              <span>services/agent-dotnet</span>
            </li>
            <li>
              <PlugZap className="sidebar-context-list__icon" />
              <span>packages/shared-protocol</span>
            </li>
          </ul>
        </div>
      </aside>
    )
  }

  return (
    <aside className="workspace-sidebar" aria-label="会话侧栏">
      <div className="workspace-sidebar__header workspace-sidebar__header--chat">
        <div>
          <p className="section-kicker">Workspace</p>
          <h2 className="workspace-sidebar__title">会话</h2>
        </div>
        <button type="button" className="sidebar-action" onClick={onCreateSession}>
          <Plus className="sidebar-action__icon" />
          新建
        </button>
      </div>

      <label className="workspace-sidebar__search">
        <Search className="workspace-sidebar__search-icon" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索会话或摘要"
        />
      </label>

      <div className="workspace-sidebar__session-list">
        {filteredSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`workspace-sidebar__session-item ${
              activeSessionId === session.id ? 'is-active' : ''
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="workspace-sidebar__session-title-row">
              <span className="workspace-sidebar__session-title">{session.title}</span>
              <span className="workspace-sidebar__session-time">{session.updatedAt}</span>
            </div>
            <p className="workspace-sidebar__session-summary">{session.summary}</p>
          </button>
        ))}

        {filteredSessions.length === 0 ? (
          <div className="workspace-sidebar__empty">没有匹配的会话结果。</div>
        ) : null}
      </div>

      <div className="sidebar-context-card">
        <p className="sidebar-context-card__eyebrow">当前工作区</p>
        <ul className="sidebar-context-list">
          <li>
            <FolderTree className="sidebar-context-list__icon" />
            <span>apps/web</span>
          </li>
          <li>
            <Workflow className="sidebar-context-list__icon" />
            <span>services/agent-dotnet</span>
          </li>
          <li>
            <PlugZap className="sidebar-context-list__icon" />
            <span>packages/shared-protocol</span>
          </li>
        </ul>
      </div>
    </aside>
  )
}