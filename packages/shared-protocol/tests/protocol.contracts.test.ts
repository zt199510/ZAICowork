import type {
  AgentRpcEvent,
  AgentRpcRequest,
  AgentRunRequest,
  BashToolInput,
  ErrorPayload,
  EventEnvelope,
  GrepToolInput,
  LogPayload,
  ReadToolInput,
  StatusPayload,
  StreamEvent,
  ToolCallCompletedPayload,
  ToolCallStartedPayload,
  ToolInput,
} from '../src/index'

function expectType<T>(_value: T): void {}

const readInput: ReadToolInput = { path: 'README.md' }
const grepInput: GrepToolInput = { pattern: 'TODO', path: 'apps' }
const bashInput: BashToolInput = { command: 'npm run lint' }

expectType<ToolInput>(readInput)
expectType<ToolInput>(grepInput)
expectType<ToolInput>(bashInput)

const toolCallStarted: ToolCallStartedPayload = {
  callId: 'tool-call-1',
  toolName: 'read',
  input: readInput,
  inputSummary: 'read README.md',
}

const toolCallCompleted: ToolCallCompletedPayload = {
  callId: 'tool-call-1',
  toolName: 'read',
  status: 'completed',
  resultPreview: 'README preview',
  outputText: 'README contents',
  outputTruncated: false,
  durationMs: 42,
  exitCode: 0,
}

const logPayload: LogPayload = {
  source: 'bridge',
  level: 'info',
  message: 'Bridge forwarded event stream.',
}

const statusPayload: StatusPayload = {
  state: 'running',
  message: 'Agent is processing the request.',
}

const errorPayload: ErrorPayload = {
  code: 'bridge_error',
  message: 'Bridge is temporarily unavailable.',
  retriable: true,
}

const logEvent: EventEnvelope<'log', LogPayload> = {
  type: 'log',
  runId: 'run-1',
  timestamp: '2026-04-14T00:00:00.000Z',
  payload: logPayload,
}

const streamEvents: StreamEvent[] = [
  {
    type: 'run_started',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:00.000Z',
    payload: { model: 'gpt-5.4' },
  },
  {
    type: 'token_delta',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:01.000Z',
    payload: { text: 'Partial output' },
  },
  {
    type: 'tool_call_started',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:02.000Z',
    payload: toolCallStarted,
  },
  {
    type: 'tool_call_completed',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:03.000Z',
    payload: toolCallCompleted,
  },
  logEvent,
  {
    type: 'status',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:04.000Z',
    payload: statusPayload,
  },
  {
    type: 'run_completed',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:05.000Z',
    payload: { outputSummary: 'Run completed successfully.' },
  },
  {
    type: 'error',
    runId: 'run-1',
    timestamp: '2026-04-14T00:00:06.000Z',
    payload: errorPayload,
  },
]

expectType<StreamEvent[]>(streamEvents)

const runRequest: AgentRunRequest = {
  runId: 'run-1',
  prompt: 'read: README.md',
  model: 'gpt-5.4',
  systemPrompt: 'You are a helpful coding assistant.',
}

const rpcRequest: AgentRpcRequest = {
  id: 'rpc-1',
  method: 'agent.run',
  params: runRequest,
}

const rpcEvent: AgentRpcEvent = {
  id: 'rpc-1',
  method: 'agent.event',
  params: logEvent,
}

expectType<AgentRpcRequest>(rpcRequest)
expectType<AgentRpcEvent>(rpcEvent)

// @ts-expect-error ReadToolInput requires a path.
const invalidReadInput: ReadToolInput = {}

// @ts-expect-error GrepToolInput requires a pattern.
const invalidGrepInput: GrepToolInput = { path: 'apps' }

// @ts-expect-error BashToolInput requires a command.
const invalidBashInput: BashToolInput = { pattern: 'pwd' }

const invalidToolCallStarted: ToolCallStartedPayload = {
  callId: 'tool-call-2',
  // @ts-expect-error ToolCallStartedPayload rejects unknown tool names.
  toolName: 'list',
  input: readInput,
  inputSummary: 'list files',
}

const invalidToolCallCompleted: ToolCallCompletedPayload = {
  callId: 'tool-call-2',
  toolName: 'grep',
  status: 'completed',
  resultPreview: 'TODO matches',
  outputText: 'TODO: investigate',
  // @ts-expect-error ToolCallCompletedPayload requires a boolean outputTruncated flag.
  outputTruncated: 'false',
  durationMs: 18,
}

const invalidStatusPayload: StatusPayload = {
  // @ts-expect-error StatusPayload only accepts run states, not bridge states.
  state: 'ready',
  message: 'Bridge ready',
}

const invalidErrorPayload: ErrorPayload = {
  code: 'bridge_error',
  message: 'Retry later',
  // @ts-expect-error ErrorPayload.retriable must be boolean.
  retriable: 'yes',
}

const invalidRunStartedEvent: StreamEvent = {
  type: 'run_started',
  runId: 'run-2',
  timestamp: '2026-04-14T00:00:00.000Z',
  // @ts-expect-error run_started payload must contain model.
  payload: {},
}

const invalidRpcRequest: AgentRpcRequest = {
  id: 'rpc-2',
  // @ts-expect-error AgentRpcRequest only accepts method "agent.run".
  method: 'agent.start',
  params: runRequest,
}

const invalidRpcEvent: AgentRpcEvent = {
  id: 'rpc-2',
  method: 'agent.event',
  params: {
    type: 'log',
    runId: 'run-2',
    timestamp: '2026-04-14T00:00:00.000Z',
    payload: {
      source: 'renderer',
      // @ts-expect-error AgentRpcEvent params must be a valid StreamEvent payload.
      level: 'debug',
      message: 'Unsupported level',
    },
  },
}
