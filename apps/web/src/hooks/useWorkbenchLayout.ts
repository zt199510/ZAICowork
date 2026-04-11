import { useEffect, useState } from 'react'
import type { AuxiliaryPanelTab, BottomPanelTab, PrimaryView } from '../types/workbench'

export function useWorkbenchLayout() {
  const [activeActivity, setActiveActivity] = useState<PrimaryView>('chat')
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240)
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true)
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>('logs')
  const [auxiliaryPanelWidth, setAuxiliaryPanelWidth] = useState(300)
  const [isAuxiliaryPanelOpen, setIsAuxiliaryPanelOpen] = useState(false)
  const [activeAuxiliaryTab, setActiveAuxiliaryTab] = useState<AuxiliaryPanelTab>('details')

  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingBottom, setIsResizingBottom] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        setLeftSidebarWidth(Math.max(170, Math.min(600, e.clientX - 48)))
      } else if (isResizingBottom) {
        setBottomPanelHeight(Math.max(100, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY)))
      }
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      setIsResizingBottom(false)
    }

    if (isResizingSidebar || isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize'
    } else {
      document.body.style.cursor = 'default'
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, isResizingBottom])

  return {
    activeActivity,
    leftSidebarWidth,
    isLeftSidebarOpen,
    bottomPanelHeight,
    isBottomPanelOpen,
    activeBottomTab,
    auxiliaryPanelWidth,
    isAuxiliaryPanelOpen,
    activeAuxiliaryTab,
    isResizingSidebar,
    isResizingBottom,
    setActiveActivity,
    setLeftSidebarWidth,
    setIsLeftSidebarOpen,
    setBottomPanelHeight,
    setIsBottomPanelOpen,
    setActiveBottomTab,
    setAuxiliaryPanelWidth,
    setIsAuxiliaryPanelOpen,
    setActiveAuxiliaryTab,
    startResizeSidebar: () => setIsResizingSidebar(true),
    startResizeBottom: () => setIsResizingBottom(true),
  }
}
