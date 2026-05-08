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
  voice_phone_number: string | null
  voice_phone_provider: string
  voice_phone_mode: string
  voice_public_phone_number: string | null
  voice_forwarding_notes: string | null
  voice_operational_status: string
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
          <select name="plan" required defaultValue={normalizePlan(client.plan)}>
            <option value="essential">Esencial</option>
            <option value="professional">Profesional</option>
            <option value="enterprise">Enterprise</option>
          </select>
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

      <section className="stack">
        <div>
          <p className="eyebrow">Agente de voz</p>
          <h2>Telefonía operativa</h2>
          <p className="muted">
            Configuración interna de TALIA para provisión, desvíos, portabilidad y soporte.
          </p>
        </div>

        <div className="form-row">
          <label className="field">
            Número TALIA asignado
            <input name="voice_phone_number" defaultValue={client.voice_phone_number ?? ''} placeholder="+34931234567" />
          </label>
          <label className="field">
            Número público del cliente
            <input name="voice_public_phone_number" defaultValue={client.voice_public_phone_number ?? ''} placeholder="+34900123456" />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            Proveedor telefónico
            <select name="voice_phone_provider" defaultValue={client.voice_phone_provider}>
              <option value="elevenlabs">ElevenLabs Phone Numbers</option>
              <option value="twilio">Twilio</option>
              <option value="external">Externo / cliente</option>
            </select>
          </label>
          <label className="field">
            Modo de número
            <select name="voice_phone_mode" defaultValue={client.voice_phone_mode}>
              <option value="talia_number">Número gestionado por TALIA</option>
              <option value="client_forwarding">Desvío desde número del cliente</option>
              <option value="portability">Portabilidad</option>
            </select>
          </label>
        </div>

        <label className="field">
          Estado operativo
          <select name="voice_operational_status" defaultValue={client.voice_operational_status}>
            <option value="draft">Borrador</option>
            <option value="provisioning">Provisionando</option>
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="error">Error</option>
          </select>
        </label>

        <label className="field">
          Notas internas de desvío y operación
          <textarea
            name="voice_forwarding_notes"
            defaultValue={client.voice_forwarding_notes ?? ''}
            rows={4}
            placeholder="Ej. El cliente desvía su número público al número TALIA fuera de horario."
          />
        </label>
      </section>

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function normalizePlan(plan: string) {
  const value = plan.toLowerCase()
  if (value === 'professional' || value === 'profesional') return 'professional'
  if (value === 'enterprise' || value === 'empresa') return 'enterprise'
  return 'essential'
}
