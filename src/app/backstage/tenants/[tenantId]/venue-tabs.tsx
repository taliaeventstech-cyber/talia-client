import Link from 'next/link'

export type VenueTabKey = 'knowledge' | 'traceability'

const tabs: Array<{ key: VenueTabKey; label: string }> = [
  { key: 'knowledge', label: 'Salud del conocimiento' },
  { key: 'traceability', label: 'Trazabilidad de las respuestas' },
]

export function VenueTabs({ activeTab, tenantId }: { activeTab: VenueTabKey; tenantId: string }) {
  return (
    <nav className="backstage-tabs backstage-venue-tabs" aria-label="Secciones operativas del venue">
      {tabs.map((tab) => (
        <Link
          aria-current={activeTab === tab.key ? 'page' : undefined}
          className={`backstage-tab ${activeTab === tab.key ? 'backstage-tab-active' : ''}`}
          href={`/backstage/tenants/${tenantId}?tab=${tab.key}`}
          key={tab.key}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
