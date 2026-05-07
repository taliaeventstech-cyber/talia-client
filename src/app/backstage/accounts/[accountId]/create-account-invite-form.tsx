'use client'

import { useActionState, useRef } from 'react'
import { createAccountInviteAction, type CreateAccountInviteState } from '../../actions'

type VenueOption = {
  id: string
  name: string
}

const initialState: CreateAccountInviteState = { ok: false, message: '' }

export function CreateAccountInviteForm({ accountId, venues }: { accountId: string; venues: VenueOption[] }) {
  const [state, action, pending] = useActionState(createAccountInviteAction, initialState)
  const inputRef = useRef<HTMLInputElement>(null)

  async function copyInviteUrl() {
    if (!state.inviteUrl) return
    await navigator.clipboard.writeText(state.inviteUrl)
  }

  return (
    <form action={action} className="invite-create-panel stack">
      <input type="hidden" name="account_id" value={accountId} />

      <div className="section-title-row">
        <div>
          <p className="eyebrow">Nueva invitación</p>
          <h2>Invitar usuario</h2>
          <p className="muted">
            La invitación vincula el usuario al account. Puedes limitarla a una venue concreta si lo necesitas.
          </p>
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
          <input name="email" type="email" required placeholder="cliente@organizacion.com" />
        </label>
        <label className="field">
          Rol
          <select name="role" defaultValue="admin">
            <option value="owner">Owner account</option>
            <option value="admin">Admin</option>
            <option value="operator">Operador atención</option>
            <option value="analyst">Analista data</option>
            <option value="viewer">Solo lectura</option>
          </select>
        </label>
      </div>

      <label className="field">
        Alcance
        <select name="theatre_id" defaultValue="">
          <option value="">Todo el account</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              Solo {venue.name}
            </option>
          ))}
        </select>
        <span className="field-hint">
          Todo el account permite ver sus venues según el rol asignado. Usa una venue concreta para accesos acotados.
        </span>
      </label>

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Creando...' : 'Crear invitación'}
      </button>
    </form>
  )
}
