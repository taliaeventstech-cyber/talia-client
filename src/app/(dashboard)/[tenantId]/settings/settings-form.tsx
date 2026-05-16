'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { useActionState } from 'react'
import { updateTenantSettings, type SettingsFormState } from './actions'

type SettingsFormLabels = {
  chatbot: string
  plan: string
  initialMessage: string
  primaryColor: string
  fallbackEmail: string
  fallbackPhone: string
  autoOpen: string
  delay: string
  channelPrompt: string
  channelPromptHint: string
  saving: string
  save: string
}

type SettingsFormProps = {
  tenantId: string
  theatre: {
    plan: string
    system_prompt: string | null
    fallback_email: string | null
    fallback_phone: string | null
  }
  widgetConfig: {
    initialMessage: string
    primaryColor: string
    autoOpen: boolean
    autoOpenDelay: number
  }
  labels: SettingsFormLabels
}

const initialState: SettingsFormState = {
  ok: false,
  message: '',
}

export function SettingsForm({ tenantId, theatre, widgetConfig, labels }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateTenantSettings.bind(null, tenantId), initialState)

  return (
    <form action={formAction} className="stack">
      <ActionToast state={state} />

      <section className="card stack">
        <h2>{labels.chatbot}</h2>
        <div className="form-grid">
          <label className="field">
            {labels.plan}
            <select name="plan" defaultValue={theatre.plan}>
              <option value="esencial">Esencial</option>
              <option value="profesional">Profesional</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label className="field">
            {labels.initialMessage}
            <textarea name="initial_message" defaultValue={widgetConfig.initialMessage} rows={3} />
          </label>

          <label className="field">
            {labels.primaryColor}
            <input name="primary_color" type="color" defaultValue={widgetConfig.primaryColor} style={{ height: 44 }} />
          </label>

          <label className="field">
            {labels.fallbackEmail}
            <input name="fallback_email" type="email" defaultValue={theatre.fallback_email ?? ''} />
          </label>

          <label className="field">
            {labels.fallbackPhone}
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
            {labels.autoOpen}
          </label>
          <label className="field" style={{ margin: 0 }}>
            {labels.delay}
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
        <h2>{labels.channelPrompt}</h2>
        <p className="muted">{labels.channelPromptHint}</p>
        <textarea
          name="system_prompt"
          defaultValue={theatre.system_prompt ?? ''}
          rows={8}
          className="mono"
          placeholder="Instrucciones específicas para el chatbot web."
        />
      </section>

      <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
        {pending ? labels.saving : labels.save}
      </button>
    </form>
  )
}
