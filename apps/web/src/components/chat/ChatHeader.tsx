import { Briefcase, CircleHelp, Code2, FolderTree, ShieldCheck } from 'lucide-react'
import type { RunState } from '@aiide/shared-protocol'
import type { WorkMode } from '../../types/workbench'

type ChatHeaderProps = {
  title: string
  summary: string
  runState: RunState
  statusText: string
  workMode: WorkMode
  onWorkModeChange: (mode: WorkMode) => void
}

const modeOptions: Array<{
  value: WorkMode
  label: string
  icon: typeof CircleHelp
}> = [
  { value: 'clarify', label: 'Clarify', icon: CircleHelp },
  { value: 'cowork', label: 'Cowork', icon: Briefcase },
  { value: 'code', label: 'Code', icon: Code2 },
  { value: 'acp', label: 'ACP', icon: ShieldCheck },
]

export function ChatHeader({
  title,
  summary,
  runState,
  statusText,
  workMode,
  onWorkModeChange,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="chat-header__top-row">
        <div>
          <p className="section-kicker">AIIde Workspace</p>
          <h1 className="chat-header__title">{title}</h1>
          <p className="chat-header__summary">{summary}</p>
        </div>

        <div className="chat-header__meta">
          <div className={`status-pill status-pill--${runState}`}>{statusText}</div>
          <div className="model-pill">GPT-5.4</div>
        </div>
      </div>

      <div className="chat-header__bottom-row">
        <div className="mode-switch" role="tablist" aria-label="会话模式">
          {modeOptions.map((option) => {
            const Icon = option.icon

            return (
              <button
                key={option.value}
                type="button"
                className={`mode-switch__button ${workMode === option.value ? 'is-active' : ''}`}
                data-mode={option.value}
                onClick={() => onWorkModeChange(option.value)}
              >
                <Icon className="mode-switch__icon" />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>

        <div className="chat-header__path">
          <FolderTree className="chat-header__path-icon" />
          <span>apps/web · services/agent-dotnet · shared-protocol</span>
        </div>
      </div>
    </header>
  )
}