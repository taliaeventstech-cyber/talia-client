'use client'

import { ActionToast } from '@/components/ui/action-toast'
import { useActionState, useState } from 'react'
import { updateAccessibilitySettings, type AccessibilitySettingsFormState } from './actions'

type Labels = {
  enabled: string
  clearViewEnabled: string
  position: string
  language: string
  primaryColor: string
  highlightColor: string
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
    highlightColor: string
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <ToggleCard
            name="enabled"
            label={labels.enabled}
            defaultChecked={values.enabled}
          />
          <ToggleCard
            name="clear_view_enabled"
            label={labels.clearViewEnabled}
            defaultChecked={values.clearViewEnabled}
          />
        </div>

        <div className="form-grid">
          <label className="field">
            {labels.primaryColor}
            <input name="primary_color" type="color" defaultValue={values.primaryColor} style={{ height: 44 }} />
          </label>

          <label className="field">
            {labels.highlightColor}
            <input name="highlight_color" type="color" defaultValue={values.highlightColor} style={{ height: 44 }} />
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

function ToggleCard({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <label
      style={{
        alignItems: 'center',
        background: 'rgba(255,255,255,.035)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        minHeight: 68,
        padding: '0.9rem 1rem',
      }}
    >
      <span style={{ color: 'var(--color-text)', fontWeight: 700, lineHeight: 1.25 }}>
        {label}
      </span>
      <span style={{ position: 'relative', flex: '0 0 auto' }}>
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          style={{
            height: 1,
            opacity: 0,
            position: 'absolute',
            width: 1,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            alignItems: 'center',
            background: checked ? 'var(--color-accent)' : 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.18)',
            borderRadius: 999,
            display: 'flex',
            height: 30,
            justifyContent: checked ? 'flex-end' : 'flex-start',
            padding: 3,
            width: 54,
          }}
        >
          <span
            style={{
              background: '#fff',
              borderRadius: 999,
              boxShadow: '0 2px 8px rgba(0,0,0,.22)',
              height: 22,
              width: 22,
            }}
          />
        </span>
      </span>
    </label>
  )
}
