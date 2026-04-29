'use client'

import { useActionState } from 'react'
import { updateTenantSettings, type SettingsFormState } from './actions'

type SettingsFormProps = {
  tenantId: string
  theatre: {
    plan: string
    system_prompt: string | null
    fallback_email: string | null
    fallback_phone: string | null
  }
  widgetConfig: {
    assistantName: string
    primaryColor: string
  }
  scrapeUrls: string[]
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

export function SettingsForm({ tenantId, theatre, widgetConfig, scrapeUrls }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)

  return (
    <form action={formAction} style={{ display: 'grid', gap: '1.5rem' }}>
      {state.message ? (
        <p
          role="status"
          style={{
            margin: 0,
            border: `1px solid ${state.ok ? '#86efac' : '#fca5a5'}`,
            borderRadius: 8,
            padding: '0.75rem',
            color: state.ok ? '#166534' : '#991b1b',
            background: state.ok ? '#f0fdf4' : '#fef2f2',
          }}
        >
          {state.message}
        </p>
      ) : null}

      <section>
        <h2>Chatbot</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <label style={fieldStyle}>
            Plan
            <select name="plan" defaultValue={theatre.plan} style={inputStyle}>
              <option value="esencial">Esencial</option>
              <option value="profesional">Profesional</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label style={fieldStyle}>
            Nombre del asistente
            <input name="assistant_name" defaultValue={widgetConfig.assistantName} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            Color principal
            <input name="primary_color" type="color" defaultValue={widgetConfig.primaryColor} style={{ ...inputStyle, height: 44 }} />
          </label>

          <label style={fieldStyle}>
            Email fallback
            <input name="fallback_email" type="email" defaultValue={theatre.fallback_email ?? ''} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            Teléfono fallback
            <input name="fallback_phone" defaultValue={theatre.fallback_phone ?? ''} style={inputStyle} />
          </label>
        </div>
      </section>

      <section>
        <h2>Prompt base</h2>
        <textarea
          name="system_prompt"
          defaultValue={theatre.system_prompt ?? ''}
          rows={12}
          style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
        />
      </section>

      <section>
        <h2>URLs scrapeables</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              name={`scrape_url_${index + 1}`}
              defaultValue={scrapeUrls[index] ?? ''}
              placeholder="https://..."
              style={inputStyle}
            />
          ))}
        </div>
      </section>

      <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: '0.75rem',
  font: 'inherit',
}

const buttonStyle: React.CSSProperties = {
  width: 'fit-content',
  border: 0,
  borderRadius: 8,
  padding: '0.8rem 1rem',
  background: '#111',
  color: '#fff',
  font: 'inherit',
  cursor: 'pointer',
}
