import { Briefcase, CircleHelp, Code2, FolderTree, ShieldCheck } from 'lucide-react'
import type { BridgeState, RunState } from '@aiide/shared-protocol'
import type { WorkMode } from '../../types/workbench'

const bridgeLabel: Record<BridgeState, string> = {
  idle: 'Connecting',
  ready: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Unavailable',
}

type ChatHeaderProps = {
  title: string
  summary: string
  runState: RunState
  statusText: string
  workMode: WorkMode
  bridgeState: BridgeState | null
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
  bridgeState,
  onWorkModeChange,
}: ChatHeaderProps) {
  return (
    <header className="chat-workspace-header">
      <div className="chat-workspace-header__main">
        <h1 className="chat-workspace-header__title">{title}</h1>
      </div>

      <div className="chat-workspace-header__meta">
        <div className="connection-status">
          <FolderTree size={14} className="folder-icon" />
          <span className="workspace-path">ZAICowork</span>
          {bridgeState && bridgeState !== 'ready' && (
             <span className={`bridge-pill bridge-pill--${bridgeState}`}>
               {bridgeLabel[bridgeState]}
             </span>
          )}
        </div>
      </div>
    </header>
  )
}