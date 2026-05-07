'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

type AccountTabKey = 'venues' | 'users' | 'plan' | 'activity'

const tabs: { key: AccountTabKey; label: string }[] = [
  { key: 'venues', label: 'Venues' },
  { key: 'users', label: 'Usuarios' },
  { key: 'plan', label: 'Plan y módulos' },
  { key: 'activity', label: 'Actividad' },
]

interface AccountTabsProps {
  venues: ReactNode
  users: ReactNode
  plan: ReactNode
  activity: ReactNode
  initialTab?: AccountTabKey
}

export function AccountTabs({ venues, users, plan, activity, initialTab = 'venues' }: AccountTabsProps) {
  const [activeTab, setActiveTab] = useState<AccountTabKey>(initialTab)

  return (
    <section className="account-tabs-shell">
      <div className="backstage-tabs" role="tablist" aria-label="Secciones del account">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`backstage-tab ${activeTab === tab.key ? 'backstage-tab-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="account-tab-panel" role="tabpanel">
        {activeTab === 'venues' ? venues : null}
        {activeTab === 'users' ? users : null}
        {activeTab === 'plan' ? plan : null}
        {activeTab === 'activity' ? activity : null}
      </div>
    </section>
  )
}
