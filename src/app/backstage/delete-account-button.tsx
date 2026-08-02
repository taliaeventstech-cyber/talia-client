'use client'

import { Trash2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { deleteAccountAction, type DeleteAccountState } from './actions'

const initialState: DeleteAccountState = { ok: false, message: '' }

interface DeleteAccountButtonProps {
  accountId: string
  accountName: string
  iconOnly?: boolean
}

export function DeleteAccountButton({ accountId, accountName, iconOnly = false }: DeleteAccountButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [state, action, pending] = useActionState(deleteAccountAction, initialState)

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
    <form action={action} className="delete-inline-confirm">
      <input type="hidden" name="account_id" value={accountId} />
      <p>
        Eliminar <strong>{accountName}</strong> borrará sus venues, conversaciones, fuentes,
        configuraciones y accesos. Las auditorías y registros legales de facturación se conservan
        sin vincularlos a una cuenta activa.
      </p>
      {state.message ? <p className="notice notice-error" role="alert">{state.message}</p> : null}
      <div className="delete-inline-actions">
        <button className="button-outline" type="button" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </button>
        <button className="button-outline button-danger" type="submit" disabled={pending}>
          {pending ? 'Eliminando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}
