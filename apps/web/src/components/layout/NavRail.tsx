import {
  CalendarDays,
  FolderOpen,
  MessageSquare,
  Settings,
  WandSparkles,
} from 'lucide-react'
import type { PrimaryView } from '../../types/workbench'

type NavRailProps = {
  activeView: PrimaryView
  onSelectView: (view: PrimaryView) => void
}

const primaryItems: Array<{
  value: Exclude<PrimaryView, 'settings'>
  label: string
  icon: typeof MessageSquare
}> = [
  { value: 'chat', label: '会话', icon: MessageSquare },
  { value: 'tasks', label: '任务', icon: CalendarDays },
  { value: 'resources', label: '资源', icon: FolderOpen },
  { value: 'skills', label: '技能', icon: WandSparkles },
]

export function NavRail({ activeView, onSelectView }: NavRailProps) {
  return (
    <aside className="nav-rail" aria-label="主导航">
      <div className="nav-rail__brand">
        <div className="nav-rail__brand-mark">AI</div>
      </div>

      <div className="nav-rail__items">
        {primaryItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.value}
              type="button"
              className={`nav-rail__button ${activeView === item.value ? 'is-active' : ''}`}
              onClick={() => onSelectView(item.value)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="nav-rail__icon" />
            </button>
          )
        })}
      </div>

      <div className="nav-rail__bottom">
        <button
          type="button"
          className={`nav-rail__button ${activeView === 'settings' ? 'is-active' : ''}`}
          onClick={() => onSelectView('settings')}
          aria-label="设置"
          title="设置"
        >
          <Settings className="nav-rail__icon" />
        </button>

        <span className="nav-rail__version">web</span>
      </div>
    </aside>
  )
}