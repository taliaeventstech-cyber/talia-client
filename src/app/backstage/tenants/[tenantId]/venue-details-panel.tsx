'use client'

import { Settings2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

export function VenueDetailsPanel({ venueName, children }: { venueName: string; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      document.body.classList.remove('dialog-open')
    }

    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])

  const open = () => {
    document.body.classList.add('dialog-open')
    dialogRef.current?.showModal()
  }

  const close = () => dialogRef.current?.close()

  return (
    <>
      <span className="tooltip-wrap">
        <button className="icon-button" type="button" aria-label={`Información y configuración de ${venueName}`} onClick={open}>
          <Settings2 aria-hidden="true" size={16} strokeWidth={2} />
        </button>
        <span className="tooltip-tip">Información y configuración</span>
      </span>

      <dialog
        className="backstage-venue-dialog"
        ref={dialogRef}
        aria-labelledby="venue-details-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className="backstage-venue-dialog-shell">
          <header className="backstage-venue-dialog-header">
            <div>
              <p className="eyebrow">Cliente y venue</p>
              <h2 id="venue-details-title">{venueName}</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Cerrar información del venue" onClick={close}>
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          </header>
          <div className="backstage-venue-dialog-content stack">{children}</div>
        </div>
      </dialog>
    </>
  )
}
