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
          <span className="tool-card__duration" style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)' }}>
            {entry.durationMs}ms
          </span>
        ) : null}
      </div>

      {isRunning ? (
        <div className="tool-card__body tool-card__body--running">执行中...</div>
      ) : null}

      {!isRunning && entry.resultPreview ? (
        <div className="tool-card__body">{entry.resultPreview}</div>
      ) : null}

      {!isRunning && entry.outputText ? (
        <details className="tool-card__output">
          <summary>
            OUT
            {entry.outputTruncated ? <span className="tool-card__truncated-badge" style={{ marginLeft: '8px', opacity: 0.6 }}>TRUNCATED</span> : null}
          </summary>
          <pre>{entry.outputText}</pre>
        </details>
      ) : null}
    </article>
  )
}

export const MessageTimeline = forwardRef<HTMLDivElement, MessageTimelineProps>(
  function MessageTimeline({ messages, timeline }, ref) {
    if (messages.length === 0) {
      return (
        <section className="message-list message-list--empty" ref={ref}>
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '8px' }}>ZAICowork Workbench</h2>
            <p style={{ fontSize: '13px' }}>Start by describing your task.</p>
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