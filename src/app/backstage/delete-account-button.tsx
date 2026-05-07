'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteAccountAction } from './actions'

interface DeleteAccountButtonProps {
  accountId: string
  accountName: string
  iconOnly?: boolean
}

export function DeleteAccountButton({ accountId, accountName, iconOnly = false }: DeleteAccountButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <span className={iconOnly ? 'tooltip-wrap tooltip-wrap-right' : undefined}>
        <button
          className={iconOnly ? 'icon-button icon-button-danger' : 'button-outline button-danger'}
          type="button"
          aria-label={`Eliminar ${accountName}`}
          onClick={() => setConfirming(true)}
        >
          {iconOnly ? <Trash2 aria-hidden="true" size={16} strokeWidth={2} /> : (
            <>
              <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
              Eliminar account
            </>
          )}
        </button>
        {iconOnly ? <span className="tooltip-tip">Eliminar account</span> : null}
      </span>
    )
  }

  return (
    <form action={deleteAccountAction} className="delete-inline-confirm">
      <input type="hidden" name="account_id" value={accountId} />
      <p>
        Eliminar <strong>{accountName}</strong> borrará también sus venues asociadas.
      </p>
      <div className="delete-inline-actions">
        <button className="button-outline" type="button" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
        <button className="button-outline button-danger" type="submit">
          Confirmar
        </button>
      </div>
    </form>
  )
}
