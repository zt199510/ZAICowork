import { forwardRef } from 'react'
import type { Message, TimelineItem, ToolCallEntry } from '../../types/workbench'

type MessageTimelineProps = {
  messages: Message[]
  timeline: TimelineItem[]
}

function ToolCard({ entry }: { entry: ToolCallEntry }) {
  const isRunning = entry.status === 'running'
  const isFailed = entry.status === 'failed'

  return (
    <article className={`tool-card tool-card--${entry.status}`}>
      <div className="tool-card__header">
        <span className={`tool-card__dot tool-card__dot--${entry.status}`} />
        <span className="tool-card__name">{entry.toolName}</span>
        <span className="tool-card__summary">{entry.inputSummary}</span>
        {entry.durationMs != null && !isRunning ? (
          <span className="tool-card__duration">{entry.durationMs}ms</span>
        ) : null}
      </div>

      {isRunning ? (
        <p className="tool-card__body tool-card__body--running">执行中...</p>
      ) : null}

      {!isRunning && entry.resultPreview ? (
        <p className="tool-card__body">{entry.resultPreview}</p>
      ) : null}

      {!isRunning && entry.outputText ? (
        <details className="tool-card__output">
          <summary>
            查看输出
            {entry.outputTruncated ? <span className="tool-card__truncated-badge">已截断</span> : null}
          </summary>
          <pre>{entry.outputText}</pre>
        </details>
      ) : null}

      {isFailed && entry.errorCode ? (
        <p className="tool-card__error-code">
          <span className="tool-card__error-label">{entry.errorCode}</span>
          {entry.retryHint ? <span className="tool-card__retry-hint">{entry.retryHint}</span> : null}
        </p>
      ) : null}

      {isFailed && !entry.errorCode && entry.retryHint ? (
        <p className="tool-card__hint">{entry.retryHint}</p>
      ) : null}
    </article>
  )
}

export const MessageTimeline = forwardRef<HTMLDivElement, MessageTimelineProps>(
  function MessageTimeline({ messages, timeline }, ref) {
    if (messages.length === 0 && timeline.length === 0) {
      return (
        <section className="message-list message-list--empty" ref={ref} aria-label="消息流">
          <div className="message-empty-state">
            <p className="section-kicker">Ready</p>
            <h2>输入一个任务目标，开始第一轮执行。</h2>
            <p>这里会承接会话消息、运行状态和后续的差异产物。</p>
            <p className="message-empty-hint">
              支持命令：<code>read: &lt;path&gt;</code> · <code>grep: &lt;pattern&gt; [path]</code> · <code>bash: &lt;command&gt;</code>
            </p>
          </div>
        </section>
      )
    }

    // Build combined timeline: messages first, then tool calls interleaved
    const combinedItems: TimelineItem[] = []
    let toolIdx = 0

    for (const msg of messages) {
      combinedItems.push({ kind: 'message', data: msg })

      // After assistant message, inject any tool calls that came during this run
      if (msg.role === 'assistant' && msg.runId) {
        while (toolIdx < timeline.length) {
          const item = timeline[toolIdx]
          if (item.kind === 'tool_call') {
            combinedItems.push(item)
            toolIdx++
          } else {
            break
          }
        }
      }
    }

    // Append remaining tool calls (if any)
    while (toolIdx < timeline.length) {
      combinedItems.push(timeline[toolIdx])
      toolIdx++
    }

    return (
      <section className="message-list" ref={ref} aria-label="消息流">
        {combinedItems.map((item, index) => {
          if (item.kind === 'message') {
            const message = item.data as Message
            return (
              <article key={message.id} className={`message message--${message.role}`}>
                <p className="message__role">{message.role === 'user' ? '你' : '助手'}</p>
                <p className="message__content">{message.content || '正在等待增量输出...'}</p>
              </article>
            )
          }

          const entry = item.data as ToolCallEntry
          return <ToolCard key={`tool-${entry.callId}-${index}`} entry={entry} />
        })}
      </section>
    )
  },
)