'use client'

import { Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createVenueAction, type CreateTenantState } from '../../actions'

const initialState: CreateTenantState = { ok: false, message: '' }

export function CreateVenueForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(createVenueAction, initialState)
  const [open, setOpen] = useState(false)
  const isOpen = open || Boolean(state.message)

  return (
    <>
      <button
        className={`floating-create-button ${isOpen ? 'floating-create-button-open' : ''}`}
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus aria-hidden="true" size={20} strokeWidth={2} />
        Añadir venue
      </button>

      {isOpen ? (
        <form action={action} className="card stack floating-create-panel">
          <input type="hidden" name="account_id" value={accountId} />

          <div className="section-title-row">
            <div>
              <p className="eyebrow">Nueva venue</p>
              <h2>Añadir venue</h2>
              <p className="muted">
                Crea una venue dentro de esta cuenta y define su plan, módulos y fuentes operativas.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Cerrar formulario"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" size={16} strokeWidth={2} />
            </button>
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
              Nombre de la venue
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
              Plan de la venue
              <select name="plan" defaultValue="essential" required>
                <option value="essential">Esencial</option>
                <option value="professional">Profesional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              Web oficial
              <input name="website_url" type="url" placeholder="https://www.venue.com" />
              <span className="field-hint">Se usará también como primera URL de scraping.</span>
            </label>
            <label className="field">
              Email fallback
              <input name="fallback_email" type="email" placeholder="info@venue.com" />
            </label>
          </div>

          <div className="form-row">
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
            {pending ? 'Creando...' : 'Crear venue'}
          </button>
        </form>
      ) : null}
    </>
  )
}
