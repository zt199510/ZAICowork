export type RunState = 'idle' | 'running' | 'completed' | 'failed' | 'canceled'

export type ToolName = 'read' | 'grep' | 'bash'

export type ToolCallStatus = 'running' | 'completed' | 'failed'

export type StreamEventType =
  | 'run_started'
  | 'token_delta'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'status'
  | 'run_completed'
  | 'error'

export interface EventEnvelope<TType extends StreamEventType, TPayload> {
  type: TType
  runId: string
  timestamp: string
  payload: TPayload
}

export interface TokenDeltaPayload {
  text: string
}

export interface ReadToolInput {
  path: string
}

export interface GrepToolInput {
  pattern: string
  path?: string
}

export interface BashToolInput {
  command: string
}

export type ToolInput = ReadToolInput | GrepToolInput | BashToolInput

export interface ToolCallStartedPayload {
  callId: string
  toolName: ToolName
  input: ToolInput
  inputSummary: string
}

export interface ToolCallCompletedPayload {
  callId: string
  toolName: ToolName
  status: ToolCallStatus
  resultPreview: string
  outputText: string
  outputTruncated: boolean
  durationMs: number
  exitCode?: number
  errorCode?: string
  retryHint?: string
}

export interface StatusPayload {
  state: RunState
  message: string
}

export interface ErrorPayload {
  code: string
  message: string
  retriable: boolean
}

export type StreamEvent =
  | EventEnvelope<'run_started', { model: string }>
  | EventEnvelope<'token_delta', TokenDeltaPayload>
  | EventEnvelope<'tool_call_started', ToolCallStartedPayload>
  | EventEnvelope<'tool_call_completed', ToolCallCompletedPayload>
  | EventEnvelope<'status', StatusPayload>
  | EventEnvelope<'run_completed', { outputSummary: string }>
  | EventEnvelope<'error', ErrorPayload>

export interface AgentRunRequest {
  runId: string
  prompt: string
  model: string
  systemPrompt?: string
}

export interface AgentRpcRequest {
  id: string
  method: 'agent.run'
  params: AgentRunRequest
}

export interface AgentRpcEvent {
  id: string
  method: 'agent.event'
  params: StreamEvent
}
