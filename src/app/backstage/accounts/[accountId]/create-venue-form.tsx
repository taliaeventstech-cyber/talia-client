'use client'

import { ChevronDown, Plus } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createVenueAction, type CreateTenantState } from '../../actions'

const initialState: CreateTenantState = { ok: false, message: '' }

export function CreateVenueForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(createVenueAction, initialState)
  const [open, setOpen] = useState(false)
  const isOpen = open || Boolean(state.message)

  return (
    <section className="card stack">
      <button
        className="collapsible-header"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((current) => !current)}
      >
        <div>
          <p className="eyebrow">Nuevo centro</p>
          <h2>Añadir centro</h2>
          <p className="muted">
            Crea una venue dentro de esta cuenta. Hereda el plan del account y permite configurar módulos por centro.
          </p>
        </div>
        <span className="button-outline button-fit collapsible-action">
          <Plus aria-hidden="true" size={15} strokeWidth={2} />
          Añadir centro
          <ChevronDown
            className="collapsible-chevron"
            data-open={isOpen}
            aria-hidden="true"
            size={18}
            strokeWidth={2}
          />
        </span>
      </button>

      {isOpen ? (
        <form action={action} className="stack">
          <input type="hidden" name="account_id" value={accountId} />

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
              Nombre del centro
              <input name="name" required placeholder="IDEAL Barcelona" />
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
              Web oficial
              <input name="website_url" type="url" placeholder="https://www.centro.com" />
              <span className="field-hint">Se usará también como primera URL de scraping.</span>
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              Email fallback
              <input name="fallback_email" type="email" placeholder="info@centro.com" />
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
            {pending ? 'Creando...' : 'Crear centro'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
