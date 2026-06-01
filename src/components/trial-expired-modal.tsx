'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useState } from 'react'

export function TrialExpiredModal({ tenantId }: { tenantId: string }) {
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || pathname === `/${tenantId}/upgrade` || pathname.startsWith(`/${tenantId}/upgrade/`)) {
    return null
  }

  return (
    <div className="trial-expired-overlay" role="presentation">
      <section
        aria-labelledby="trial-expired-title"
        aria-modal="true"
        className="trial-expired-modal"
        role="dialog"
      >
        <header className="trial-expired-modal-header">
          <h2 id="trial-expired-title">Tu prueba gratuita de 7 días ha terminado</h2>
          <button className="trial-expired-close" type="button" onClick={() => setDismissed(true)} aria-label="Cerrar aviso">
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="trial-expired-modal-body">
          <div>
            <h3>Haz upgrade para seguir usando TALIA</h3>
            <p>
              Mantén activo el chatbot web, el agente de correo y las métricas de Àgora con un plan mensual.
            </p>
          </div>

          <div className="trial-expired-preview" aria-hidden="true">
            <div className="trial-preview-card trial-preview-card-chatbot">
              <span>Chatbot Web</span>
              <p>Hola, ¿en qué puedo ayudarte?</p>
            </div>
            <div className="trial-preview-card trial-preview-card-email">
              <span>Agent de Correu</span>
              <p>Borrador preparado para revisar.</p>
            </div>
            <div className="trial-preview-card trial-preview-card-agora">
              <span>Àgora</span>
              <p>Actividad, temas y uso mensual.</p>
            </div>
          </div>
        </div>

        <footer className="trial-expired-modal-actions">
          <Link className="button-outline" href={`/${tenantId}/upgrade`}>
            Ver todos los planes
          </Link>
          <Link className="button-primary" href={`/${tenantId}/upgrade`}>
            Upgrade ahora
          </Link>
        </footer>
      </section>
    </div>
  )
}
