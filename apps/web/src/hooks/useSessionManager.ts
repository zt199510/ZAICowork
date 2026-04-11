import { useMemo, useState } from 'react'
import type { Message, TimelineItem, ToolCallEntry } from '../types/workbench'

export type SessionRecord = {
  id: string
  title: string
  updatedAt: string
  summary: string
  messages: Message[]
  toolCalls: Map<string, ToolCallEntry>
  timeline: TimelineItem[]
  draft: string
}

const initialSessionRecords: SessionRecord[] = [
  {
    id: 's-1',
    title: '重构登录流程',
    updatedAt: '2 分钟前',
    summary: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
    draft: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-1',
        role: 'user',
        content: '请把用户服务拆分成 domain/application/infrastructure 三层，并给出迁移步骤。',
      },
      {
        id: 'm-2',
        role: 'assistant',
        content:
          '收到。我会先输出迁移计划，再逐步改动文件并在每一步给出差异说明，最后执行 lint 与构建验证。',
      },
    ],
  },
  {
    id: 's-2',
    title: '实现 MCP 工具桥接',
    updatedAt: '15 分钟前',
    summary: '为前端增加工具调用状态和事件透出，并保持 SSE 协议清晰可调试。',
    draft: '',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-3',
        role: 'user',
        content: '请为前端补齐工具调用开始/完成状态，并在右侧展示日志与流事件。',
      },
      {
        id: 'm-4',
        role: 'assistant',
        content: '可以，建议先把事件、日志和计划拆成独立面板，再把桥接状态接进去。',
      },
    ],
  },
  {
    id: 's-3',
    title: '修复 CI lint 失败',
    updatedAt: '昨天',
    summary: '定位 lint 失败根因，优先修复严格类型和无用变量问题。',
    draft: '',
    toolCalls: new Map(),
    timeline: [],
    messages: [
      {
        id: 'm-5',
        role: 'user',
        content: '请先分析 lint 错误来源，再给出最小改动的修复方案。',
      },
      {
        id: 'm-6',
        role: 'assistant',
        content: '会先确认报错集中在哪些文件，再避免顺手修改不相关代码。',
      },
    ],
  },
]

export function useSessionManager() {
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>(initialSessionRecords)
  const [activeSessionId, setActiveSessionId] = useState(initialSessionRecords[0]?.id ?? '')

  const activeSession = useMemo(
    () => sessionRecords.find((s) => s.id === activeSessionId) ?? sessionRecords[0] ?? null,
    [activeSessionId, sessionRecords],
  )

  const prompt = useMemo(() => activeSession?.draft ?? '', [activeSession])
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession])
  const timeline = useMemo(() => activeSession?.timeline ?? [], [activeSession])

  const updateSessionRecord = (sessionId: string, updater: (session: SessionRecord) => SessionRecord) => {
    setSessionRecords((current) =>
      current.map((s) => (s.id === sessionId ? updater(s) : s)),
    )
  }

  const createSession = () => {
    const sessionId = crypto.randomUUID()
    setSessionRecords((current) => [
      {
        id: sessionId,
        title: '新会话',
        updatedAt: '刚刚',
        summary: '等待任务目标',
        draft: '',
        messages: [],
        toolCalls: new Map(),
        timeline: [],
      },
      ...current,
    ])
    setActiveSessionId(sessionId)
    return sessionId
  }

  const handlePromptChange = (value: string) => {
    if (!activeSession) return
    updateSessionRecord(activeSession.id, (s) => ({ ...s, draft: value }))
  }

  return {
    sessionRecords,
    activeSessionId,
    activeSession,
    prompt,
    messages,
    timeline,
    setActiveSessionId,
    updateSessionRecord,
    createSession,
    handlePromptChange,
  }
}
