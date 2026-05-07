'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { createTenantAction, type CreateTenantState } from './actions'

const initialState: CreateTenantState = { ok: false, message: '' }

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenantAction, initialState)

  return (
    <form action={action} className="card stack">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Nuevo cliente</p>
          <h2>Crear cliente</h2>
          <p className="muted">
            Alta la entidad, activa los módulos contratados y después genera una invitación.
          </p>
        </div>
      </div>

      {state.message ? (
        <p className={`notice ${state.ok ? 'notice-success' : 'notice-error'}`}>
          {state.message}
          {state.tenantId ? (
            <>
              {' '}
              <Link className="link-accent" href={`/backstage/tenants/${state.tenantId}/invites`}>
                Crear invitación
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="form-row">
        <label className="field">
          Nombre de la entidad
          <input name="name" required placeholder="Teatre Nacional de Catalunya" />
        </label>
        <label className="field">
          Tipo
          <select name="entity_type" defaultValue="theatre">
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
          <select name="primary_language" defaultValue="es">
            <option value="es">Español</option>
            <option value="ca">Català</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="field">
          Plan
          <select name="plan" defaultValue="essential" required>
            <option value="essential">Esencial</option>
            <option value="professional">Profesional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
      </div>

      <label className="field">
        Web oficial
        <input name="website_url" type="url" placeholder="https://www.teatro.com" />
        <span className="field-hint">Se usará también como primera URL de scraping.</span>
      </label>

      <div className="form-row">
        <label className="field">
          Email fallback
          <input name="fallback_email" type="email" placeholder="info@teatro.com" />
        </label>
        <label className="field">
          Teléfono fallback
          <input name="fallback_phone" placeholder="+34 900 000 000" />
        </label>
      </div>

      <fieldset className="module-checkbox-grid">
        <legend>Módulos contratados</legend>
        <label>
          <input type="checkbox" name="modules" value="chatbot" defaultChecked disabled />
          Chatbot
        </label>
        <label>
          <input type="checkbox" name="modules" value="data" defaultChecked disabled />
          Data
        </label>
        <label>
          <input type="checkbox" name="modules" value="voice" />
          Voz
        </label>
        <label>
          <input type="checkbox" name="modules" value="email" />
          Email
        </label>
        <label>
          <input type="checkbox" name="modules" value="whatsapp" />
          WhatsApp
        </label>
        <label>
          <input type="checkbox" name="modules" value="instagram" />
          Instagram
        </label>
        <label>
          <input type="checkbox" name="modules" value="marketing" />
          Marketing
        </label>
      </fieldset>

      <button className="button-primary button-fit" type="submit" disabled={pending}>
        {pending ? 'Creando...' : 'Crear cliente'}
      </button>
    </form>
  )
}
