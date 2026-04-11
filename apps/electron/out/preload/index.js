"use strict";
const electron = require("electron");
const agentApi = {
  startRun: (request) => electron.ipcRenderer.invoke("agent:start-run", request),
  cancelRun: (runId) => electron.ipcRenderer.invoke("agent:cancel-run", runId),
  onRunEvent: (runId, callback) => {
    const channel = `agent:run-event:${runId}`;
    const handler = (_event, data) => {
      callback(data);
    };
    electron.ipcRenderer.on(channel, handler);
    return () => {
      electron.ipcRenderer.removeListener(channel, handler);
    };
  }
};
electron.contextBridge.exposeInMainWorld("agentApi", agentApi);
