'use client'

import { useActionState } from 'react'
import { createTenant, type OnboardingFormState } from './actions'

const initialState: OnboardingFormState = {
  ok: false,
  message: '',
}

export function OnboardingForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(createTenant, initialState)

  return (
    <form action={action} className="form-grid">
      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <label className="field">
        Nombre del teatro
        <input name="theatre_name" required placeholder="Teatre Nacional de Catalunya" />
      </label>

      <label className="field">
        Web oficial
        <input name="website_url" type="url" placeholder="https://www.tnc.cat/es" />
      </label>

      <div className="form-row">
        <label className="field">
          Email de contacto
          <input name="fallback_email" type="email" placeholder={email || 'info@teatro.com'} />
        </label>

        <label className="field">
          Teléfono
          <input name="fallback_phone" placeholder="+34 ..." />
        </label>
      </div>

      <div className="form-row-narrow">
        <label className="field">
          Nombre del asistente
          <input name="assistant_name" defaultValue="TALIA" required />
        </label>

        <label className="field">
          Color
          <input name="primary_color" defaultValue="#000000" pattern="^#[0-9a-fA-F]{6}$" required />
        </label>
      </div>

      <button
        className="button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? 'Creando teatro...' : 'Crear teatro y entrar'}
      </button>
    </form>
  )
}
