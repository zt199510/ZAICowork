import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { BridgeState } from '@aiide/shared-protocol'
import { AgentBridge } from './agent-bridge'

let mainWindow: BrowserWindow | null = null
const agentBridge = new AgentBridge()
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const shouldVerifyCrashRecovery = process.env.AIIDE_VERIFY_CRASH_RECOVERY === '1'
let hasStartedVerification = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // In dev, load the renderer dev server; in prod, load the built file.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (shouldVerifyCrashRecovery) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (hasStartedVerification) return
      hasStartedVerification = true
      void runCrashRecoveryVerification()
    })
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  agentBridge.onStateChange((state: BridgeState) => {
    mainWindow?.webContents.send('agent:bridge-state-changed', state)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  agentBridge.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

async function runCrashRecoveryVerification(): Promise<void> {
  if (!mainWindow) {
    console.error('[verify:crash-recovery] {"passed":false,"steps":[{"name":"window-missing","passed":false,"detail":"Main window was not created."}],"commands":[]}')
    process.exitCode = 1
    app.quit()
    return
  }

  try {
    const result = await mainWindow.webContents.executeJavaScript(
      "import('/verifyCrashRecovery.ts').then(({ runCrashRecoveryVerification }) => runCrashRecoveryVerification())",
      true,
    )
    console.log(`[verify:crash-recovery] ${JSON.stringify(result)}`)
    process.exitCode = result?.passed ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[verify:crash-recovery] ${JSON.stringify({
      passed: false,
      steps: [{ name: 'execution-error', passed: false, detail: message }],
      commands: [],
    })}`)
    process.exitCode = 1
  } finally {
    app.quit()
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('agent:start-run', async (_event, request: { id: string; method: string; params: { runId: string; prompt: string; model: string; systemPrompt?: string } }) => {
    const { runId } = request.params

    agentBridge.startRun(request, (event) => {
      mainWindow?.webContents.send(`agent:run-event:${runId}`, event)
    })

    return { ok: true, runId }
  })

  ipcMain.handle('agent:cancel-run', async (_event, runId: string) => {
    agentBridge.cancelRun(runId)
    return { ok: true, runId }
  })

  ipcMain.handle('agent:get-bridge-state', () => {
    return agentBridge.state
  })

  if (isDev) {
    ipcMain.handle('agent:debug-crash-run', async (_event, runId: string) => {
      agentBridge.debugCrashRun(runId)
      return { ok: true, runId }
    })
  }
}
