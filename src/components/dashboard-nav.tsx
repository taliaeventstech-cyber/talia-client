'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mail, MessageCircle, MessageSquare, Network, SlidersHorizontal, Megaphone } from 'lucide-react'

export function DashboardNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="dashboard-nav" aria-label="Navegación principal">
      <div className="nav-section nav-section-first">
        <p className="nav-section-label">Atención</p>

        <div className="nav-channel">
          <div className="nav-channel-title">
            <span>Chatbot web</span>
            <span className="nav-channel-status">Activo</span>
          </div>
          <div className="nav-subnav">
            <Link
              className={`nav-link nav-link-nested ${active(`/${tenantId}/conversations`) ? 'nav-link-active' : ''}`}
              href={`/${tenantId}/conversations`}
            >
              <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
              Conversaciones
            </Link>
            <Link
              className={`nav-link nav-link-nested ${active(`/${tenantId}/analytics`) ? 'nav-link-active' : ''}`}
              href={`/${tenantId}/analytics`}
            >
              <Network size={14} strokeWidth={2} aria-hidden="true" />
              Análisis
            </Link>
            <Link
              className={`nav-link nav-link-nested ${active(`/${tenantId}/settings`) ? 'nav-link-active' : ''}`}
              href={`/${tenantId}/settings`}
            >
              <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
              Configuración
            </Link>
          </div>
        </div>

        

        <div className="nav-channel">
          <div className="nav-channel-title">
         
            <span>Agente de voz</span>
          </div>
          <div className="nav-subnav">
            <Link
              className={`nav-link nav-link-nested ${active(`/${tenantId}/voice/settings`) ? 'nav-link-active' : ''}`}
              href={`/${tenantId}/voice/settings`}
            >
              <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
              Configuración
            </Link>
          </div>
        </div>

        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <Mail size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Agente de email</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>

        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <MessageCircle size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>WhatsApp</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>
      </div>

<div className="nav-section">
        <p className="nav-section-label">Marketing</p>
        <div className="nav-channel nav-channel-disabled" aria-disabled="true">
          <div className="nav-channel-title">
            <Megaphone size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Campañas</span>
            <span className="nav-channel-status">Próximo</span>
          </div>
        </div>
      </div>

    </nav>
  )
}
