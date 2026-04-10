import type { KeyboardEvent } from 'react'
import type { WorkMode } from '../../types/workbench'

type PromptComposerProps = {
  prompt: string
  workMode: WorkMode
  disabled: boolean
  canCancel: boolean
  onPromptChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

const modeHints: Record<WorkMode, string> = {
  clarify: '适合先拆需求和边界，再进入执行。',
  cowork: '适合连续多轮协作与回合式推进。',
  code: '适合直接做代码、验证和回填结果。',
  acp: '适合严谨执行、审批和较强过程约束。',
}

export function PromptComposer({
  prompt,
  workMode,
  disabled,
  canCancel,
  onPromptChange,
  onSubmit,
  onCancel,
}: PromptComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <footer className="composer">
      <div className="composer__shell">
        <div className="composer__header">
          <label htmlFor="prompt" className="composer__label">
            输入任务目标
          </label>
          <div className="composer__meta">
            <span>{modeHints[workMode]}</span>
            <span>Ctrl/Cmd + Enter 发送</span>
          </div>
        </div>

        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：把当前会话界面重构成分层布局，并补齐验证步骤。"
          disabled={disabled}
        />

        <div className="composer__actions">
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={!canCancel}>
            取消运行
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onSubmit}
            disabled={!prompt.trim() || disabled}
          >
            {disabled ? '执行中...' : '开始执行'}
          </button>
        </div>
      </div>
    </footer>
  )
}