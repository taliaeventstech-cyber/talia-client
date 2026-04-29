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
    <form action={action} style={{ display: 'grid', gap: '1rem' }}>
      {state.message ? (
        <p style={{ background: state.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${state.ok ? '#86efac' : '#fca5a5'}`, borderRadius: 6, padding: '0.75rem', color: state.ok ? '#166534' : '#b91c1c' }}>
          {state.message}
        </p>
      ) : null}

      <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
        Nombre del teatro
        <input name="theatre_name" required placeholder="Teatre Nacional de Catalunya" style={inputStyle} />
      </label>

      <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
        Web oficial
        <input name="website_url" type="url" placeholder="https://www.tnc.cat/es" style={inputStyle} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          Email de contacto
          <input name="fallback_email" type="email" placeholder={email || 'info@teatro.com'} style={inputStyle} />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          Teléfono
          <input name="fallback_phone" placeholder="+34 ..." style={inputStyle} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          Nombre del asistente
          <input name="assistant_name" defaultValue="TALIA" required style={inputStyle} />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          Color
          <input name="primary_color" defaultValue="#000000" pattern="^#[0-9a-fA-F]{6}$" required style={inputStyle} />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{ marginTop: '0.5rem', padding: '0.85rem', border: 0, borderRadius: 6, background: '#000', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
      >
        {pending ? 'Creando teatro...' : 'Crear teatro y entrar'}
      </button>
    </form>
  )
}

const inputStyle = {
  padding: '0.75rem',
  fontSize: '1rem',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fff',
} satisfies React.CSSProperties
