import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { AgentRpcEvent, StreamEvent } from '@aiide/shared-protocol'

type RunRecord = {
  runId: string
  child?: ChildProcessWithoutNullStreams
  terminal: boolean
  canceled: boolean
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

  /** Resolve the monorepo root (two levels above apps/electron). */
  private get monorepoRoot(): string {
    // __dirname is apps/electron/out/main at runtime
    return resolve(__dirname, '../../../..')
  }

  private get agentProjectPath(): string {
    return resolve(this.monorepoRoot, 'services/agent-dotnet/src/AIIde.Agent/AIIde.Agent.csproj')
  }

  private createStatusEvent(
    runId: string,
    state: 'running' | 'completed' | 'failed' | 'canceled',
    message: string,
  ): StreamEvent {
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

    const existing = this.runs.get(runId)
    if (existing?.child) {
      onEvent(this.createErrorEvent(runId, 'Run already started.', false))
      return
    }

    const run: RunRecord = {
      runId,
      terminal: false,
      canceled: false,
      broadcast: (event: StreamEvent) => {
        onEvent(event)
        if (this.isTerminalEvent(event)) {
          run.terminal = true
          this.scheduleCleanup(run)
        }
      },
    }

    this.runs.set(runId, run)

    run.broadcast(this.createStatusEvent(runId, 'running', 'Electron main started agent process.'))

    const child = spawn('dotnet', ['run', '--project', this.agentProjectPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.monorepoRoot,
    })

    run.child = child

    const stdout = createInterface({ input: child.stdout })
    const stderr = createInterface({ input: child.stderr })

    stdout.on('line', (line: string) => {
      if (!line.trim()) return
      try {
        const rpcEvent = JSON.parse(line) as AgentRpcEvent
        run.broadcast(rpcEvent.params)
      } catch {
        run.broadcast(this.createErrorEvent(runId, 'Failed to parse agent stdout event.', false))
      }
    })

    stderr.on('line', (line: string) => {
      if (!line.trim() || run.terminal) return
      run.broadcast(this.createStatusEvent(runId, 'running', `agent stderr: ${line}`))
    })

    child.on('error', (error: Error) => {
      if (run.terminal) return
      run.broadcast(this.createErrorEvent(runId, error.message, true))
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
          this.createErrorEvent(runId, `Agent process exited with code ${code ?? 'unknown'}.`, true),
        )
        return
      }

      if (!run.terminal) {
        run.broadcast(this.createStatusEvent(runId, 'completed', 'Agent process exited cleanly.'))
        run.terminal = true
        this.scheduleCleanup(run)
      }
    })

    child.stdin.write(`${JSON.stringify(request)}\n`)
    child.stdin.end()
  }

  cancelRun(runId: string): void {
    const run = this.runs.get(runId)
    if (!run) return

    run.canceled = true

    if (!run.terminal) {
      run.broadcast(this.createStatusEvent(runId, 'canceled', 'Run canceled by user.'))
    }

    run.child?.kill()
    run.child = undefined
  }

  dispose(): void {
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
