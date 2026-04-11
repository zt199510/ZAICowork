import { createContext, useContext } from 'react'
import type { useWorkbenchLayout } from '../hooks/useWorkbenchLayout'
import type { useSessionManager } from '../hooks/useSessionManager'
import type { useAgentRun } from '../hooks/useAgentRun'

export type WorkbenchContextValue = {
  layout: ReturnType<typeof useWorkbenchLayout>
  sessions: ReturnType<typeof useSessionManager>
  agentRun: ReturnType<typeof useAgentRun>
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) throw new Error('useWorkbench must be used within WorkbenchContext.Provider')
  return ctx
}
