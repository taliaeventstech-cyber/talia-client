'use client'

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type ToastNoticeProps = {
  message: string
  tone?: 'success' | 'error' | 'warning' | 'info'
}

export function ToastNotice({ message, tone = 'info' }: ToastNoticeProps) {
  const [visible, setVisible] = useState(Boolean(message))
  const [activeMessage, setActiveMessage] = useState(message)

  useEffect(() => {
    queueMicrotask(() => {
      setActiveMessage(message)
      setVisible(Boolean(message))
    })
    if (!message) return

    const timeout = window.setTimeout(() => setVisible(false), 6500)
    return () => window.clearTimeout(timeout)
  }, [message])

  if (!visible || !activeMessage) return null

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Info

  return (
    <div className={`toast-notice toast-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-notice-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2} />
      </span>
      <p>{activeMessage}</p>
      <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar notificación">
        <X size={15} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
