import {
  CalendarDays,
  FolderOpen,
  MessageSquare,
  Settings,
  WandSparkles,
} from 'lucide-react'
import type { PrimaryView } from '../../types/workbench'

type ActivityBarProps = {
  activeActivity: PrimaryView
  onSelectActivity: (activity: PrimaryView) => void
}

const primaryActivities: Array<{
  value: Exclude<PrimaryView, 'settings'>
  label: string
  icon: typeof MessageSquare
}> = [
  { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'tasks', label: 'Tasks', icon: CalendarDays },
  { value: 'resources', label: 'Resources', icon: FolderOpen },
  { value: 'skills', label: 'Skills', icon: WandSparkles },
]

export function ActivityBar({ activeActivity, onSelectActivity }: ActivityBarProps) {
  return (
    <aside className="activity-bar" aria-label="Activity Bar">
      <div className="activity-bar__top">
        {primaryActivities.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.value}
              type="button"
              className={`activity-bar__button ${activeActivity === item.value ? 'is-active' : ''}`}
              onClick={() => onSelectActivity(item.value)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="activity-bar__icon" />
            </button>
          )
        })}
      </div>

      <div className="activity-bar__bottom">
        <button
          type="button"
          className={`activity-bar__button ${activeActivity === 'settings' ? 'is-active' : ''}`}
          onClick={() => onSelectActivity('settings')}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="activity-bar__icon" />
        </button>
      </div>
    </aside>
  )
}