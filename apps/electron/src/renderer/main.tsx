import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Re-use the web workspace App component and styles directly.
// The transport layer in agentClient auto-detects Electron IPC via window.agentApi.
import App from '../../../web/src/App'
import '../../../web/src/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
