import { FolderTree } from 'lucide-react'
import type { BridgeState } from '@aiide/shared-protocol'
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
  runState: string
  statusText: string
  workMode: WorkMode
  bridgeState: BridgeState | null
  onWorkModeChange: (mode: WorkMode) => void
}

export function ChatHeader({
  title,
  bridgeState,
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