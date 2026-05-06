'use client'

import { useActionState } from 'react'
import { updateTenantAction, type UpdateTenantState } from '../../actions'

const initialState: UpdateTenantState = { ok: false, message: '' }

type Client = {
  id: string
  name: string
  entity_type: string
  primary_language: string
  plan: string
  website_url: string | null
  fallback_email: string | null
  fallback_phone: string | null
}

type Module = {
  module_key: string
  status: string
}

const editableModules = [
  { key: 'chatbot', label: 'Chatbot', locked: true },
  { key: 'data', label: 'Data', locked: true },
  { key: 'voice', label: 'Voz' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'marketing', label: 'Marketing' },
]

export function EditClientForm({ client, modules }: { client: Client; modules: Module[] }) {
  const [state, action, pending] = useActionState(updateTenantAction, initialState)
  const activeModules = new Set(
    modules
      .filter((module) => module.status === 'active' || module.status === 'trial')
      .map((module) => module.module_key)
  )

  return (
    <form action={action} className="card stack">
      <input type="hidden" name="tenant_id" value={client.id} />

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
        </p>
      ) : null}

      <div className="form-row">
        <label className="field">
          Nombre de la entidad
          <input name="name" required defaultValue={client.name} />
        </label>
        <label className="field">
          Tipo
          <select name="entity_type" defaultValue={client.entity_type}>
            <option value="theatre">Teatro</option>
            <option value="museum">Museo</option>
            <option value="cinema">Cine</option>
            <option value="auditorium">Auditorio</option>
            <option value="festival">Festival</option>
            <option value="cultural_center">Centro cultural</option>
            <option value="other">Otro</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          Idioma principal
          <select name="primary_language" defaultValue={client.primary_language}>
            <option value="es">Español</option>
            <option value="ca">Català</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="field">
          Plan
          <input name="plan" required defaultValue={client.plan} />
        </label>
      </div>

      <label className="field">
        Web oficial
        <input name="website_url" type="url" defaultValue={client.website_url ?? ''} />
      </label>

      <div className="form-row">
        <label className="field">
          Email fallback
          <input name="fallback_email" type="email" defaultValue={client.fallback_email ?? ''} />
        </label>
        <label className="field">
          Teléfono fallback
          <input name="fallback_phone" defaultValue={client.fallback_phone ?? ''} />
        </label>
      </div>

      <fieldset className="module-checkbox-grid">
        <legend>Módulos contratados</legend>
        {editableModules.map((module) => (
          <label key={module.key}>
            <input
              type="checkbox"
              name="modules"
              value={module.key}
              defaultChecked={module.locked || activeModules.has(module.key)}
              disabled={module.locked}
            />
            {module.label}
          </label>
        ))}
      </fieldset>

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
