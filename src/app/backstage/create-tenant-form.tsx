'use client'

import { Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createTenantAction, type CreateTenantState } from './actions'

const initialState: CreateTenantState = { ok: false, message: '' }

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenantAction, initialState)
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
        Nuevo cliente
      </button>

      {isOpen ? (
        <form action={action} className="card stack floating-create-panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Nuevo cliente</p>
              <h2>Crear cliente</h2>
              <p className="muted">
                Crea el account comercial. Después añade una venue para configurar agentes, fuentes y accesos.
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
              {state.accountId ? (
                <>
                  {' · '}
                  <Link className="link-accent" href={`/backstage/accounts/${state.accountId}`}>
                    Ver account
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <label className="field">
            Nombre del cliente
            <input name="name" required placeholder="IDEAL Layers of Reality" />
          </label>

          <label className="field">
            Email de facturación
            <input name="billing_email" type="email" placeholder="admin@cliente.com" />
            <span className="field-hint">Se usará como contacto comercial del account.</span>
          </label>

          <button className="button-primary button-fit" type="submit" disabled={pending}>
            {pending ? 'Creando...' : 'Crear cliente'}
          </button>
        </form>
      ) : null}
    </>
  )
}
