export type Session = {
  id: string
  title: string
  updatedAt: string
  summary: string
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  runId?: string
}

export type PrimaryView = 'chat' | 'tasks' | 'resources' | 'skills' | 'settings'

export type ModuleView = Exclude<PrimaryView, 'chat'>

export type WorkMode = 'clarify' | 'cowork' | 'code' | 'acp'

export type RightPanelTab = 'plan' | 'logs' | 'events'

export type EventPreview = {
  id: string
  type: string
  summary: string
}