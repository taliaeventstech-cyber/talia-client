'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useState } from 'react'

export type TrialExpiredModalLabels = {
  title: string
  close: string
  headline: string
  description: string
  chatbotTitle: string
  chatbotMessage: string
  agoraTitle: string
  agoraMessage: string
  viewPlans: string
  upgradeNow: string
}

export function TrialExpiredModal({
  tenantId,
  labels,
}: {
  tenantId: string
  labels: TrialExpiredModalLabels
}) {
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
          <h2 id="trial-expired-title">{labels.title}</h2>
          <button className="trial-expired-close" type="button" onClick={() => setDismissed(true)} aria-label={labels.close}>
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="trial-expired-modal-body">
          <div>
            <h3>{labels.headline}</h3>
            <p>
              {labels.description}
            </p>
          </div>

          <div className="trial-expired-preview" aria-hidden="true">
            <div className="trial-preview-card trial-preview-card-chatbot">
              <span>{labels.chatbotTitle}</span>
              <p>{labels.chatbotMessage}</p>
            </div>
            <div className="trial-preview-card trial-preview-card-agora">
              <span>{labels.agoraTitle}</span>
              <p>{labels.agoraMessage}</p>
            </div>
          </div>
        </div>

        <footer className="trial-expired-modal-actions">
          <Link className="button-outline" href={`/${tenantId}/upgrade`}>
            {labels.viewPlans}
          </Link>
          <Link className="button-primary" href={`/${tenantId}/upgrade`}>
            {labels.upgradeNow}
          </Link>
        </footer>
      </section>
    </div>
  )
}
