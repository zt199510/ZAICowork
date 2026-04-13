import { type KeyboardEvent, useRef, useEffect } from 'react'
import type { WorkMode } from '../../types/workbench'
import { Bug, CornerDownLeft, X, Bot, Code } from 'lucide-react'

type PromptComposerProps = {
  prompt: string
  workMode: WorkMode
  inputDisabled: boolean
  submitDisabled: boolean
  submitBlockedReason: string | null
  canCancel: boolean
  canDebugCrash: boolean
  onPromptChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  onDebugCrash: () => void
}

const modeHints: Record<WorkMode, string> = {
  clarify: '澄清模式: 先拆需求和边界',
  cowork: '协作模式: 连续多轮推演',
  code: '编码模式: 代码生成与验证',
  acp: 'ACP模式: 严谨执行与审批',
}

export function PromptComposer({
  prompt,
  workMode,
  inputDisabled,
  submitDisabled,
  submitBlockedReason,
  canCancel,
  canDebugCrash,
  onPromptChange,
  onSubmit,
  onCancel,
  onDebugCrash,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`
    }
  }, [prompt])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!submitDisabled && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <footer className="composer">
      <div className="composer__shell">
        <div className="composer__header">
          <label htmlFor="prompt" className="composer__label">
            {workMode === 'code' ? (
              <><Code size={14} className="icon-code" /> Code Editor</>
            ) : (
              <><Bot size={14} className="icon-chat" /> Chat</>
            )}
            <span className="mode-hint-inline">· {modeHints[workMode]}</span>
          </label>
        </div>

        <textarea
          ref={textareaRef}
          id="prompt"
          className="composer textarea"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="给 ZAICowork 发送指令... (Ctrl+Enter 发送)"
          disabled={inputDisabled}
          rows={1}
        />

        <div className="composer__actions">
          <div className="composer__meta">
            {submitBlockedReason ? (
              <span className="composer__status composer__status--warning">{submitBlockedReason}</span>
            ) : (
              <span className="composer__status">Ctrl+Enter 发送</span>
            )}
          </div>
          <div className="composer__btn-group">
            {canDebugCrash && (
              <button
                type="button"
                className="button button--danger"
                onClick={onDebugCrash}
                title="仅开发态：模拟 agent 崩溃"
              >
                <Bug size={14} />
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="button button--ghost"
                onClick={onCancel}
                title="取消执行"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className="button button--primary"
              onClick={onSubmit}
              disabled={!prompt.trim() || submitDisabled}
              title="发送 (Ctrl+Enter)"
            >
              {inputDisabled ? (
                <>执行中...</>
              ) : (
                <><CornerDownLeft size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
