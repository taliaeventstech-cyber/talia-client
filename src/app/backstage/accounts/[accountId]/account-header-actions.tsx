'use client'

import { DeleteAccountButton } from '../../delete-account-button'
import { Edit3, MoreHorizontal, Power } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface AccountHeaderActionsProps {
  accountId: string
  accountName: string
}

export function AccountHeaderActions({ accountId, accountName }: AccountHeaderActionsProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
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
          <Link className="row-action-menu-item" href={`/backstage/accounts/${accountId}`} role="menuitem">
            <Edit3 aria-hidden="true" size={15} strokeWidth={2} />
            Editar account
          </Link>
          <button className="row-action-menu-item" type="button" role="menuitem" disabled>
            <Power aria-hidden="true" size={15} strokeWidth={2} />
            Desactivar account
          </button>
          <DeleteAccountButton accountId={accountId} accountName={accountName} />
        </div>
      ) : null}
    </div>
  )
}
