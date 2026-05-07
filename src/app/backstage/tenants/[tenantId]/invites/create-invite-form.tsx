'use client'

import { useActionState, useRef } from 'react'
import { createInviteAction, type CreateInviteState } from './actions'

const initialState: CreateInviteState = { ok: false, message: '' }

export function CreateInviteForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(createInviteAction, initialState)
  const inputRef = useRef<HTMLInputElement>(null)

  async function copyInviteUrl() {
    if (!state.inviteUrl) return
    await navigator.clipboard.writeText(state.inviteUrl)
  }

  return (
    <form action={action} className="card stack">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Nueva invitación</p>
          <h2>Invitar usuario del cliente</h2>
        </div>
      </div>

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>{state.message}</p>
      ) : null}

      {state.inviteUrl ? (
        <div className="copy-row">
          <input ref={inputRef} value={state.inviteUrl} readOnly />
          <button className="button-outline" type="button" onClick={copyInviteUrl}>
            Copiar
          </button>
        </div>
      ) : null}

      <div className="form-row">
        <label className="field">
          Email
          <input name="email" type="email" required placeholder="cliente@teatro.com" />
        </label>
        <label className="field">
          Rol
          <select name="role" defaultValue="owner">
            <option value="owner">Owner cliente</option>
            <option value="admin">Admin del centro</option>
            <option value="operator">Operador de atención</option>
            <option value="analyst">Analista data</option>
            <option value="viewer">Solo lectura</option>
          </select>
        </label>
      </div>

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Creando...' : 'Crear invitación'}
      </button>
    </form>
  )
}
