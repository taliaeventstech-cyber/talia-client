'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Network, Settings } from 'lucide-react'

const chatbotLinks = [
  { href: 'conversations', label: 'Conversaciones' },
]

export function DashboardNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname()

  return (
    <nav className="dashboard-nav" aria-label="Navegación principal">
      <div className="nav-section">
        <div className="nav-section-header">
          <p className="nav-section-label">Módulo Atención</p>
          <Link
            className={`nav-icon-link ${pathname === `/${tenantId}/settings` ? 'nav-icon-link-active' : ''}`}
            href={`/${tenantId}/settings`}
            aria-label="Settings chatbot"
            title="Settings chatbot"
          >
            <Settings aria-hidden="true" size={15} strokeWidth={2} />
          </Link>
        </div>

        <div className="nav-channel">
          <div className="nav-channel-title">
            <span>Chatbot web</span>
            <span className="nav-channel-status">Activo</span>
          </div>
          <div className="nav-subnav">
            {chatbotLinks.map((link) => {
              const href = `/${tenantId}/${link.href}`
              const isActive = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link key={link.href} className={`nav-link nav-link-nested ${isActive ? 'nav-link-active' : ''}`} href={href}>
                  {link.href === 'conversations' ? <MessageSquare aria-hidden="true" size={14} strokeWidth={2} /> : null}
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <span>Agente de email</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>

        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <span>Agente Instagram</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>
      </div>

      <div className="nav-section">
        <p className="nav-section-label">Módulo Data</p>
        <div className="nav-channel">
          <div className="nav-channel-title">
            <span>Chatbot</span>
          </div>
          <div className="nav-subnav">
            <Link
              className={`nav-link nav-link-nested ${pathname === `/${tenantId}/analytics` ? 'nav-link-active' : ''}`}
              href={`/${tenantId}/analytics`}
            >
              <Network aria-hidden="true" size={14} strokeWidth={2} />
              Temas e intención
            </Link>
            <div className="nav-channel nav-channel-disabled" aria-disabled="true">
              <div className="nav-channel-title nav-channel-title-nested">
                <span>Operativa</span>
                <span className="nav-channel-status">Próximo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="nav-section">
        <p className="nav-section-label">Módulo Marketing</p>
        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <span>Campañas</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
