import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent } from '@aiide/shared-protocol'

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
}

contextBridge.exposeInMainWorld('agentApi', agentApi)
