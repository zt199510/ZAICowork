"use strict";
const electron = require("electron");
const path = require("path");
const node_child_process = require("node:child_process");
const node_readline = require("node:readline");
const node_path = require("node:path");
class AgentBridge {
  runs = /* @__PURE__ */ new Map();
  _state = "idle";
  _consecutiveFailures = 0;
  _probeTimer;
  _stateListeners = /* @__PURE__ */ new Set();
  static MAX_FAILURES = 3;
  constructor() {
    void this.probeAndTransition();
  }
  get state() {
    return this._state;
  }
  onStateChange(listener) {
    this._stateListeners.add(listener);
    return () => {
      this._stateListeners.delete(listener);
    };
  }
  setState(next) {
    if (this._state === next) return;
    this._state = next;
    for (const listener of this._stateListeners) {
      listener(next);
    }
  }
  probe() {
    return new Promise((resolve2) => {
      const child = node_child_process.spawn("dotnet", ["--version"], { stdio: "ignore", timeout: 1e4 });
      child.on("error", () => resolve2(false));
      child.on("exit", (code) => resolve2(code === 0));
    });
  }
  async probeAndTransition() {
    this.setState("reconnecting");
    const available = await this.probe();
    this.setState(available ? "ready" : "failed");
  }
  scheduleProbe() {
    if (this._probeTimer) return;
    if (this._state === "reconnecting") return;
    const delay = Math.min(1e3 * 2 ** (this._consecutiveFailures - 1), 1e4);
    this._probeTimer = setTimeout(() => {
      this._probeTimer = void 0;
      void this.probeAndTransition();
    }, delay);
  }
  recordRunFailure() {
    this._consecutiveFailures++;
    if (this._consecutiveFailures >= AgentBridge.MAX_FAILURES) {
      this.scheduleProbe();
    }
  }
  recordRunSuccess() {
    this._consecutiveFailures = 0;
    if (this._state !== "ready") {
      this.setState("ready");
    }
  }
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
    if (this._state === "failed") {
      onEvent(this.createErrorEvent(runId, "Agent bridge 不可用，请检查 dotnet 环境后重试。", false));
      return;
    }
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
      this.recordRunFailure();
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
        this.recordRunFailure();
        return;
      }
      if (!run.terminal) {
        run.broadcast(this.createStatusEvent(runId, "completed", "Agent process exited cleanly."));
        run.terminal = true;
        this.scheduleCleanup(run);
        this.recordRunSuccess();
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
    if (this._probeTimer) {
      clearTimeout(this._probeTimer);
      this._probeTimer = void 0;
    }
    this._stateListeners.clear();
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
  agentBridge.onStateChange((state) => {
    mainWindow?.webContents.send("agent:bridge-state-changed", state);
  });
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
  electron.ipcMain.handle("agent:get-bridge-state", () => {
    return agentBridge.state;
  });
}
