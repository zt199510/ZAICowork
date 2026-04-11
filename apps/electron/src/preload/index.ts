import { contextBridge, ipcRenderer } from 'electron'
import type { BridgeState, StreamEvent } from '@aiide/shared-protocol'

export type AgentApi = {
  startRun: (request: {
    id: string
    method: string
    params: {
      runId: string
      prompt: string
      model: string
      systemPrompt?: string
    }
  }) => Promise<{ ok: boolean; runId: string }>

  cancelRun: (runId: string) => Promise<{ ok: boolean; runId: string }>

  onRunEvent: (
    runId: string,
    callback: (event: StreamEvent) => void,
  ) => () => void

  getBridgeState: () => Promise<BridgeState>

  onBridgeStateChange: (callback: (state: BridgeState) => void) => () => void
}

const agentApi: AgentApi = {
  startRun: (request) => ipcRenderer.invoke('agent:start-run', request),

  cancelRun: (runId) => ipcRenderer.invoke('agent:cancel-run', runId),

  onRunEvent: (runId, callback) => {
    const channel = `agent:run-event:${runId}`
    const handler = (_event: Electron.IpcRendererEvent, data: StreamEvent): void => {
      callback(data)
    }
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },

  getBridgeState: () => ipcRenderer.invoke('agent:get-bridge-state'),

  onBridgeStateChange: (callback) => {
    const channel = 'agent:bridge-state-changed'
    const handler = (_event: Electron.IpcRendererEvent, state: BridgeState): void => {
      callback(state)
    }
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
}

contextBridge.exposeInMainWorld('agentApi', agentApi)
