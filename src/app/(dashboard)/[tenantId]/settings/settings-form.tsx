'use client'

import { useActionState, useState } from 'react'
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
    autoOpen: boolean
    autoOpenDelay: number
  }
  scrapeUrls: string[]
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

export function SettingsForm({ tenantId, theatre, widgetConfig, scrapeUrls }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)
  const [urls, setUrls] = useState<string[]>(scrapeUrls.length ? scrapeUrls : [''])

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

        <div className="form-row" style={{ alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="auto_open"
              defaultChecked={widgetConfig.autoOpen}
              style={{ width: 16, height: 16 }}
            />
            Abrir widget automáticamente
          </label>
          <label className="field" style={{ margin: 0 }}>
            Retardo (segundos)
            <input
              name="auto_open_delay"
              type="number"
              min={0}
              max={60}
              defaultValue={widgetConfig.autoOpenDelay}
              style={{ width: 80 }}
            />
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
        <div className="stack" style={{ gap: 8 }}>
          {urls.map((url, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                name={`scrape_url_${index + 1}`}
                value={url}
                onChange={(e) => setUrls((prev) => prev.map((u, i) => (i === index ? e.target.value : u)))}
                placeholder="https://..."
                style={{ flex: 1 }}
              />
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => setUrls((prev) => prev.filter((_, i) => i !== index))}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                  aria-label="Eliminar URL"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {urls.length < 4 && (
          <button
            type="button"
            className="button-outline"
            onClick={() => setUrls((prev) => [...prev, ''])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Añadir URL
          </button>
        )}
      </section>

      <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  )
}
