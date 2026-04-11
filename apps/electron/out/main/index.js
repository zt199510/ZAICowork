"use strict";
const electron = require("electron");
const path = require("path");
const node_child_process = require("node:child_process");
const node_readline = require("node:readline");
const node_path = require("node:path");
class AgentBridge {
  runs = /* @__PURE__ */ new Map();
  /** Resolve the monorepo root (two levels above apps/electron). */
  get monorepoRoot() {
    return node_path.resolve(__dirname, "../../../..");
  }
  get agentProjectPath() {
    return node_path.resolve(this.monorepoRoot, "services/agent-dotnet/src/AIIde.Agent/AIIde.Agent.csproj");
  }
  createStatusEvent(runId, state, message) {
    return {
      type: "status",
      runId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      payload: { state, message }
    };
  }
  createErrorEvent(runId, message, retriable = true) {
    return {
      type: "error",
      runId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      payload: { code: "bridge_error", message, retriable }
    };
  }
  isTerminalEvent(event) {
    return event.type === "run_completed" || event.type === "error" || event.type === "status" && (event.payload.state === "canceled" || event.payload.state === "failed");
  }
  scheduleCleanup(run) {
    if (run.cleanupTimer) {
      clearTimeout(run.cleanupTimer);
    }
    run.cleanupTimer = setTimeout(() => {
      this.runs.delete(run.runId);
    }, 3e4);
  }
  startRun(request, onEvent) {
    const { runId } = request.params;
    const existing = this.runs.get(runId);
    if (existing?.child) {
      onEvent(this.createErrorEvent(runId, "Run already started.", false));
      return;
    }
    const run = {
      runId,
      terminal: false,
      canceled: false,
      broadcast: (event) => {
        onEvent(event);
        if (this.isTerminalEvent(event)) {
          run.terminal = true;
          this.scheduleCleanup(run);
        }
      }
    };
    this.runs.set(runId, run);
    run.broadcast(this.createStatusEvent(runId, "running", "Electron main started agent process."));
    const child = node_child_process.spawn("dotnet", ["run", "--project", this.agentProjectPath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.monorepoRoot
    });
    run.child = child;
    const stdout = node_readline.createInterface({ input: child.stdout });
    const stderr = node_readline.createInterface({ input: child.stderr });
    stdout.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const rpcEvent = JSON.parse(line);
        run.broadcast(rpcEvent.params);
      } catch {
        run.broadcast(this.createErrorEvent(runId, "Failed to parse agent stdout event.", false));
      }
    });
    stderr.on("line", (line) => {
      if (!line.trim() || run.terminal) return;
      run.broadcast(this.createStatusEvent(runId, "running", `agent stderr: ${line}`));
    });
    child.on("error", (error) => {
      if (run.terminal) return;
      run.broadcast(this.createErrorEvent(runId, error.message, true));
    });
    child.on("exit", (code) => {
      run.child = void 0;
      if (run.canceled) {
        run.terminal = true;
        this.scheduleCleanup(run);
        return;
      }
      if (!run.terminal && code !== 0) {
        run.broadcast(
          this.createErrorEvent(runId, `Agent process exited with code ${code ?? "unknown"}.`, true)
        );
        return;
      }
      if (!run.terminal) {
        run.broadcast(this.createStatusEvent(runId, "completed", "Agent process exited cleanly."));
        run.terminal = true;
        this.scheduleCleanup(run);
      }
    });
    child.stdin.write(`${JSON.stringify(request)}
`);
    child.stdin.end();
  }
  cancelRun(runId) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.canceled = true;
    if (!run.terminal) {
      run.broadcast(this.createStatusEvent(runId, "canceled", "Run canceled by user."));
    }
    run.child?.kill();
    run.child = void 0;
  }
  dispose() {
    for (const run of this.runs.values()) {
      run.child?.kill();
      run.child = void 0;
      if (run.cleanupTimer) {
        clearTimeout(run.cleanupTimer);
      }
    }
    this.runs.clear();
  }
}
let mainWindow = null;
const agentBridge = new AgentBridge();
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  agentBridge.dispose();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
function registerIpcHandlers() {
  electron.ipcMain.handle("agent:start-run", async (_event, request) => {
    const { runId } = request.params;
    agentBridge.startRun(request, (event) => {
      mainWindow?.webContents.send(`agent:run-event:${runId}`, event);
    });
    return { ok: true, runId };
  });
  electron.ipcMain.handle("agent:cancel-run", async (_event, runId) => {
    agentBridge.cancelRun(runId);
    return { ok: true, runId };
  });
}
