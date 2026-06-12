'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { useActionState } from 'react'
import { updateAccessibilitySettings, type AccessibilitySettingsFormState } from './actions'

type Labels = {
  enabled: string
  clearViewEnabled: string
  position: string
  language: string
  primaryColor: string
  saving: string
  save: string
}

type Props = {
  tenantId: string
  values: {
    enabled: boolean
    clearViewEnabled: boolean
    position: string
    language: string
    primaryColor: string
  }
  labels: Labels
}

const initialState: AccessibilitySettingsFormState = {
  ok: false,
  message: '',
}

export function AccessibilitySettingsForm({ tenantId, values, labels }: Props) {
  const [state, formAction, pending] = useActionState(updateAccessibilitySettings.bind(null, tenantId), initialState)

  return (
    <form action={formAction} className="stack">
      <ActionToast state={state} />

      <section className="card stack">
        <div className="form-grid">
          <label className="field" style={{ justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={values.enabled}
                style={{ width: 16, height: 16 }}
              />
              {labels.enabled}
            </span>
          </label>

          <label className="field" style={{ justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="clear_view_enabled"
                defaultChecked={values.clearViewEnabled}
                style={{ width: 16, height: 16 }}
              />
              {labels.clearViewEnabled}
            </span>
          </label>

          <label className="field">
            {labels.primaryColor}
            <input name="primary_color" type="color" defaultValue={values.primaryColor} style={{ height: 44 }} />
          </label>

          <label className="field">
            {labels.position}
            <select name="position" defaultValue={values.position}>
              <option value="bottom-right">Abajo derecha</option>
              <option value="bottom-left">Abajo izquierda</option>
              <option value="top-right">Arriba derecha</option>
              <option value="top-left">Arriba izquierda</option>
            </select>
          </label>

          <label className="field">
            {labels.language}
            <select name="language" defaultValue={values.language}>
              <option value="auto">Auto</option>
              <option value="es">Español</option>
              <option value="ca">Català</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </section>

      <button className="button-primary" type="submit" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
        {pending ? labels.saving : labels.save}
      </button>
    </form>
  )
}
