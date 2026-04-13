import { type KeyboardEvent, useRef, useEffect } from 'react'
import type { WorkMode } from '../../types/workbench'
import { CornerDownLeft, X, Bot, Code } from 'lucide-react'

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
  clarify: '澄清模式: 先拆需求和边界',
  cowork: '协作模式: 连续多轮推演',
  code: '编码模式: 代码生成与验证',
  acp: 'ACP模式: 严谨执行与审批',
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`
    }
  }, [prompt])

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
          disabled={disabled}
          rows={1}
        />

        <div className="composer__actions">
          <div className="composer__meta">
            {/* Space left for additional tools like Attach, Mentions, etc */}
          </div>
          <div className="composer__btn-group" style={{ display: 'flex', gap: '8px' }}>
            {canCancel && (
              <button 
                type="button" 
                className="button button--ghost" 
                onClick={onCancel} 
                title="取消执行"
                style={{ padding: '0 8px', height: '24px' }}
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className="button button--primary"
              onClick={onSubmit}
              disabled={!prompt.trim() || disabled}
              title="发送 (Ctrl+Enter)"
              style={{ padding: '0 8px', height: '24px', gap: '4px' }}
            >
              {disabled ? (
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