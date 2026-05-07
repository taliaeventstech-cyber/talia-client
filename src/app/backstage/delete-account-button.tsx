'use client'

import { Trash2 } from 'lucide-react'
import { deleteAccountAction } from './actions'

interface DeleteAccountButtonProps {
  accountId: string
  accountName: string
  iconOnly?: boolean
}

export function DeleteAccountButton({ accountId, accountName, iconOnly = false }: DeleteAccountButtonProps) {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Eliminar la cuenta "${accountName}" borrará también sus centros asociados. ¿Quieres continuar?`
        )

        if (!confirmed) event.preventDefault()
      }}
    >
      <input type="hidden" name="account_id" value={accountId} />
      <span className={iconOnly ? 'tooltip-wrap tooltip-wrap-right' : undefined}>
        <button
          className={iconOnly ? 'icon-button icon-button-danger' : 'button-outline button-danger'}
          type="submit"
          aria-label={`Eliminar ${accountName}`}
        >
          {iconOnly ? <Trash2 aria-hidden="true" size={16} strokeWidth={2} /> : 'Eliminar account'}
        </button>
        {iconOnly ? <span className="tooltip-tip">Eliminar account</span> : null}
      </span>
    </form>
  )
}
