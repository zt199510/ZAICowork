const { spawn } = require('node:child_process')
const path = require('node:path')

const command = process.argv[2]
const extraArgs = process.argv.slice(3)

if (!command) {
  console.error('Missing electron-vite command. Expected one of: dev, preview.')
  process.exit(1)
}

const electronVitePackageJson = require.resolve('electron-vite/package.json')
const electronViteBin = path.join(path.dirname(electronVitePackageJson), 'bin', 'electron-vite.js')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [electronViteBin, command, ...extraArgs], {
  stdio: 'inherit',
  env,
})

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
