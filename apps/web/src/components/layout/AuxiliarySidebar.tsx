import { Info, Package, X } from 'lucide-react'
import type { AuxiliaryPanelTab } from '../../types/workbench'

type AuxiliarySidebarProps = {
  activeTab: AuxiliaryPanelTab
  onSelectTab: (tab: AuxiliaryPanelTab) => void
  onClose: () => void
  width: number
}

const tabs: Array<{ value: AuxiliaryPanelTab; label: string; icon: typeof Info }> = [
  { value: 'details', label: 'Details', icon: Info },
  { value: 'artifacts', label: 'Artifacts', icon: Package },
]

export function AuxiliarySidebar({
  activeTab,
  onSelectTab,
  onClose,
  width,
}: AuxiliarySidebarProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'details':
        return (
          <div className="auxiliary-sidebar__group">
            <p className="section-label">Run Parameters</p>
            <div className="auxiliary-sidebar__list">
              <div className="auxiliary-sidebar__item">Model: GPT-5.4</div>
              <div className="auxiliary-sidebar__item">Context: Local Repo</div>
            </div>
          </div>
        )
      case 'artifacts':
        return (
          <div className="auxiliary-sidebar__empty">
            <p>No artifacts produced in this run.</p>
          </div>
        )
    }
  }

  return (
    <aside className="auxiliary-sidebar" aria-label="Auxiliary Sidebar" style={{ width }}>
      <header className="auxiliary-sidebar__header">
        <div className="auxiliary-sidebar__tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                className={`auxiliary-sidebar__tab-btn ${activeTab === tab.value ? 'is-active' : ''}`}
                onClick={() => onSelectTab(tab.value)}
                title={tab.label}
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>
        <button className="auxiliary-sidebar__close-btn" onClick={onClose} title="Close Panel">
          <X size={16} />
        </button>
      </header>
      <div className="auxiliary-sidebar__body">{renderContent()}</div>
    </aside>
  )
}
