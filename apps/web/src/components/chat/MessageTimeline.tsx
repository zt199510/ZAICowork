import { forwardRef } from 'react'
import type { Message } from '../../types/workbench'

type MessageTimelineProps = {
  messages: Message[]
}

export const MessageTimeline = forwardRef<HTMLDivElement, MessageTimelineProps>(
  function MessageTimeline({ messages }, ref) {
    if (messages.length === 0) {
      return (
        <section className="message-list message-list--empty" ref={ref} aria-label="消息流">
          <div className="message-empty-state">
            <p className="section-kicker">Ready</p>
            <h2>输入一个任务目标，开始第一轮执行。</h2>
            <p>这里会承接会话消息、运行状态和后续的差异产物。</p>
          </div>
        </section>
      )
    }

    return (
      <section className="message-list" ref={ref} aria-label="消息流">
        {messages.map((message) => (
          <article key={message.id} className={`message message--${message.role}`}>
            <p className="message__role">{message.role === 'user' ? '你' : '助手'}</p>
            <p className="message__content">{message.content || '正在等待增量输出...'}</p>
          </article>
        ))}
      </section>
    )
  },
)