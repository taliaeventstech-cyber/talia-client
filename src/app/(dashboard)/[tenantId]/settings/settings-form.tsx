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
    initialMessage: string
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
    <form action={formAction} className="stack">
      {state.message ? (
        <p
          role="status"
          className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}
        >
          {state.message}
        </p>
      ) : null}

      <section className="card stack">
        <h2>Chatbot</h2>
        <div className="form-grid">
          <label className="field">
            Plan
            <select name="plan" defaultValue={theatre.plan}>
              <option value="esencial">Esencial</option>
              <option value="profesional">Profesional</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label className="field">
            Nombre del asistente
            <input name="assistant_name" defaultValue={widgetConfig.assistantName} />
          </label>

          <label className="field">
            Mensaje inicial
            <textarea name="initial_message" defaultValue={widgetConfig.initialMessage} rows={3} />
          </label>

          <label className="field">
            Color principal
            <input name="primary_color" type="color" defaultValue={widgetConfig.primaryColor} style={{ height: 44 }} />
          </label>

          <label className="field">
            Email fallback
            <input name="fallback_email" type="email" defaultValue={theatre.fallback_email ?? ''} />
          </label>

          <label className="field">
            Teléfono fallback
            <input name="fallback_phone" defaultValue={theatre.fallback_phone ?? ''} />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>Prompt base</h2>
        <textarea
          name="system_prompt"
          defaultValue={theatre.system_prompt ?? ''}
          rows={12}
          className="mono"
        />
      </section>

      <section className="card stack">
        <h2>URLs scrapeables</h2>
        <div className="form-grid">
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              name={`scrape_url_${index + 1}`}
              defaultValue={scrapeUrls[index] ?? ''}
              placeholder="https://..."
            />
          ))}
        </div>
      </section>

      <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  )
}
