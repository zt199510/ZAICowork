import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import type {
  AgentRpcEvent,
  BridgeState,
  LogLevel,
  LogSource,
  StreamEvent,
} from '@aiide/shared-protocol'

type RunRecord = {
  runId: string
  child?: ChildProcessWithoutNullStreams
  terminal: boolean
  canceled: boolean
  failureRecorded: boolean
  cleanupTimer?: ReturnType<typeof setTimeout>
  broadcast: (event: StreamEvent) => void
}

/**
 * Manages agent-dotnet child processes in the Electron main process.
 * Ported from the Vite localAgentBridge plugin — same run lifecycle,
 * dotnet spawn, stdout JSON-RPC parsing and error mapping.
 */
export class AgentBridge {
  private runs = new Map<string, RunRecord>()
  private _state: BridgeState = 'idle'
  private _consecutiveFailures = 0
  private _probeTimer?: ReturnType<typeof setTimeout>
  private _probeInFlight = false
  private _stateListeners = new Set<(state: BridgeState) => void>()

  constructor() {
    void this.probeAndTransition()
  }

  get state(): BridgeState {
    return this._state
  }

  onStateChange(listener: (state: BridgeState) => void): () => void {
    this._stateListeners.add(listener)
    return () => { this._stateListeners.delete(listener) }
  }

  private setState(next: BridgeState): void {
    if (this._state === next) return
    this._state = next
    for (const listener of this._stateListeners) {
      listener(next)
    }
  }

  private probe(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('dotnet', ['--version'], { stdio: 'ignore', timeout: 10_000 })
      child.on('error', () => resolve(false))
      child.on('exit', (code) => resolve(code === 0))
    })
  }

  private async probeAndTransition(): Promise<void> {
    if (this._probeInFlight) return

    this._probeInFlight = true
    this.setState('reconnecting')
    const available = await this.probe().catch(() => false)
    this._probeInFlight = false
    this.setState(available ? 'ready' : 'failed')
  }

  private scheduleProbe(): void {
    if (this._probeTimer) return
    if (this._probeInFlight) return
    const delay = Math.min(1000 * 2 ** Math.max(this._consecutiveFailures - 1, 0), 10_000)
    this._probeTimer = setTimeout(() => {
      this._probeTimer = undefined
      void this.probeAndTransition()
    }, delay)
  }

  private recordRunFailure(run: RunRecord): void {
    if (run.failureRecorded) return

    run.failureRecorded = true
    this._consecutiveFailures++
    this.setState('reconnecting')
    this.scheduleProbe()
  }

  private recordRunSuccess(): void {
    this._consecutiveFailures = 0
    if (this._state !== 'ready') {
      this.setState('ready')
    }
  }

  private getStartUnavailableMessage(): string {
    switch (this._state) {
      case 'idle':
        return 'Agent bridge 正在初始化，请稍后重试。'
      case 'reconnecting':
        return 'Agent bridge 正在重连，请等待恢复后再试。'
      case 'failed':
        return 'Agent bridge 不可用，请检查 dotnet 环境后重试。'
      default:
        return 'Agent bridge 当前不可用。'
    }
  }

  /** Resolve the monorepo root (two levels above apps/electron). */
  private get monorepoRoot(): string {
    // __dirname is apps/electron/out/main at runtime
    return resolve(__dirname, '../../../..')
  }

  private get agentProjectPath(): string {
    return resolve(this.monorepoRoot, 'services/agent-dotnet/src/AIIde.Agent/AIIde.Agent.csproj')
  }

  private createStatusEvent(runId: string, state: 'canceled', message: string): StreamEvent {
    return {
      type: 'status',
      runId,
      timestamp: new Date().toISOString(),
      payload: { state, message },
    }
  }

  private createErrorEvent(runId: string, message: string, retriable = true): StreamEvent {
    return {
      type: 'error',
      runId,
      timestamp: new Date().toISOString(),
      payload: { code: 'bridge_error', message, retriable },
    }
  }

  private createLogEvent(
    runId: string,
    source: LogSource,
    level: LogLevel,
    message: string,
  ): StreamEvent {
    return {
      type: 'log',
      runId,
      timestamp: new Date().toISOString(),
      payload: { source, level, message },
    }
  }

  private isTerminalEvent(event: StreamEvent): boolean {
    return (
      event.type === 'run_completed' ||
      event.type === 'error' ||
      (event.type === 'status' &&
        (event.payload.state === 'canceled' || event.payload.state === 'failed'))
    )
  }

  private scheduleCleanup(run: RunRecord): void {
    if (run.cleanupTimer) {
      clearTimeout(run.cleanupTimer)
    }
    run.cleanupTimer = setTimeout(() => {
      this.runs.delete(run.runId)
    }, 30_000)
  }

  startRun(
    request: { id: string; method: string; params: { runId: string; prompt: string; model: string; systemPrompt?: string } },
    onEvent: (event: StreamEvent) => void,
  ): void {
    const { runId } = request.params

    if (this._state !== 'ready') {
      throw new Error(this.getStartUnavailableMessage())
    }

    const existing = this.runs.get(runId)
    if (existing?.child) {
      throw new Error('Run already started.')
    }

    const run: RunRecord = {
      runId,
      terminal: false,
      canceled: false,
      failureRecorded: false,
      broadcast: (event: StreamEvent) => {
        onEvent(event)
        if (this.isTerminalEvent(event)) {
          run.terminal = true
          this.scheduleCleanup(run)
        }
      },
    }

    this.runs.set(runId, run)

    const child = spawn('dotnet', ['run', '--project', this.agentProjectPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.monorepoRoot,
    })

    run.child = child
    run.broadcast(this.createLogEvent(runId, 'bridge', 'info', 'Electron bridge received agent.run request.'))
    run.broadcast(this.createLogEvent(runId, 'bridge', 'info', 'Electron bridge started agent process.'))

    const stdout = createInterface({ input: child.stdout })
    const stderr = createInterface({ input: child.stderr })

    stdout.on('line', (line: string) => {
      if (!line.trim()) return
      try {
        const rpcEvent = JSON.parse(line) as AgentRpcEvent
        run.broadcast(rpcEvent.params)
      } catch {
        run.broadcast(this.createLogEvent(runId, 'bridge', 'error', 'Failed to parse agent stdout event.'))
        run.broadcast(this.createErrorEvent(runId, 'Failed to parse agent stdout event.', false))
      }
    })

    stderr.on('line', (line: string) => {
      if (!line.trim() || run.terminal) return
      run.broadcast(this.createLogEvent(runId, 'agent', 'warn', `stderr: ${line}`))
    })

    child.on('error', (error: Error) => {
      if (run.terminal) return
      run.broadcast(this.createLogEvent(runId, 'bridge', 'error', error.message))
      run.broadcast(this.createErrorEvent(runId, error.message, true))
      this.recordRunFailure(run)
    })

    child.on('exit', (code: number | null) => {
      run.child = undefined

      if (run.canceled) {
        run.terminal = true
        this.scheduleCleanup(run)
        return
      }

      if (!run.terminal && code !== 0) {
        run.broadcast(
          this.createLogEvent(runId, 'bridge', 'error', `Agent process exited with code ${code ?? 'unknown'}.`),
        )
        run.broadcast(
          this.createErrorEvent(runId, `Agent process exited with code ${code ?? 'unknown'}.`, true),
        )
        this.recordRunFailure(run)
        return
      }

      if (!run.terminal) {
        run.broadcast(
          this.createLogEvent(runId, 'bridge', 'error', 'Agent process exited without a terminal event.'),
        )
        run.broadcast(this.createErrorEvent(runId, 'Agent process exited without a terminal event.', true))
        this.recordRunFailure(run)
        return
      }

      this.recordRunSuccess()
    })

    child.stdin.write(`${JSON.stringify(request)}\n`)
    child.stdin.end()
    run.broadcast(this.createLogEvent(runId, 'bridge', 'info', 'Electron bridge forwarded agent.run to agent process.'))
  }

  debugCrashRun(runId: string): void {
    const run = this.runs.get(runId)
    if (!run?.child) {
      throw new Error('No active agent process found for this run.')
    }

    run.broadcast(
      this.createLogEvent(runId, 'bridge', 'warn', 'Debug crash injection requested; terminating agent process.'),
    )
    run.child.kill()
  }

  cancelRun(runId: string): void {
    const run = this.runs.get(runId)
    if (!run) return

    run.canceled = true

    if (!run.terminal) {
      run.broadcast(this.createLogEvent(runId, 'bridge', 'info', 'Cancel requested; terminating agent process.'))
    }

    if (!run.terminal) {
      run.broadcast(this.createStatusEvent(runId, 'canceled', 'Run canceled by user.'))
    }

    run.child?.kill()
    run.child = undefined
  }

  dispose(): void {
    if (this._probeTimer) {
      clearTimeout(this._probeTimer)
      this._probeTimer = undefined
    }
    this._stateListeners.clear()
    for (const run of this.runs.values()) {
      run.child?.kill()
      run.child = undefined
      if (run.cleanupTimer) {
        clearTimeout(run.cleanupTimer)
      }
    }
    this.runs.clear()
  }
}
