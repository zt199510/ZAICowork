import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { AgentBridge } from './agent-bridge'

let mainWindow: BrowserWindow | null = null
const agentBridge = new AgentBridge()

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
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

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
}
