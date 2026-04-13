const { spawn } = require('node:child_process')
const path = require('node:path')

const command = process.execPath
const launcherPath = path.join(__dirname, 'run-electron-vite.cjs')
const env = {
  ...process.env,
  AIIDE_VERIFY_CRASH_RECOVERY: '1',
}

const child = spawn(command, [launcherPath, 'dev'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let verificationPassed = false
let sawResultLine = false
let shutdownTimer = null
let timeoutTimer = setTimeout(() => {
  console.error('[verify-crash-recovery] Timed out waiting for Electron verification to finish.')
  child.kill('SIGINT')
}, 120_000)

const scheduleShutdown = () => {
  if (shutdownTimer) return
  shutdownTimer = setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGINT')
    }
  }, 2_000)
}

const handleChunk = (chunk, write) => {
  const text = chunk.toString()
  write(text)

  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('[verify:crash-recovery]')) continue
    sawResultLine = true
    verificationPassed = line.includes('"passed":true')
    scheduleShutdown()
  }
}

child.stdout.on('data', (chunk) => handleChunk(chunk, (text) => process.stdout.write(text)))
child.stderr.on('data', (chunk) => handleChunk(chunk, (text) => process.stderr.write(text)))

child.on('exit', (code, signal) => {
  if (timeoutTimer) {
    clearTimeout(timeoutTimer)
    timeoutTimer = null
  }

  if (shutdownTimer) {
    clearTimeout(shutdownTimer)
    shutdownTimer = null
  }

  if (sawResultLine) {
    process.exit(verificationPassed ? 0 : 1)
    return
  }

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  if (timeoutTimer) {
    clearTimeout(timeoutTimer)
    timeoutTimer = null
  }

  if (shutdownTimer) {
    clearTimeout(shutdownTimer)
    shutdownTimer = null
  }

  console.error(error)
  process.exit(1)
})
