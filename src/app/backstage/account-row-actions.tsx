'use client'

import { DeleteAccountButton } from './delete-account-button'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AccountRowActionsProps {
  accountId: string
  accountName: string
}

export function AccountRowActions({ accountId, accountName }: AccountRowActionsProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="row-action-menu" ref={menuRef}>
      <button
        className="icon-button"
        type="button"
        aria-label={`Más acciones para ${accountName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {open ? (
        <div className="row-action-menu-content" role="menu">
          <DeleteAccountButton accountId={accountId} accountName={accountName} />
        </div>
      ) : null}
    </div>
  )
}
