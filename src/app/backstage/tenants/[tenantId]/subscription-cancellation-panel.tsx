'use client'

import { AlertTriangle, LockKeyhole } from 'lucide-react'
import { useActionState, useState } from 'react'
import {
  cancelCustomerSubscriptionAction,
  type AdminBillingCancellationState,
} from '../../actions'

const initialState: AdminBillingCancellationState = { ok: false, message: '' }

type SubscriptionCancellationPanelProps = {
  accountId: string
  billingEmail: string | null
  canManageBilling: boolean
  cancellationScheduled: boolean
  currentPeriodEnd: string | null
  subscriptionId: string | null
}

export function SubscriptionCancellationPanel({
  accountId,
  billingEmail,
  canManageBilling,
  cancellationScheduled,
  currentPeriodEnd,
  subscriptionId,
}: SubscriptionCancellationPanelProps) {
  const [mode, setMode] = useState<'period_end' | 'immediate'>('period_end')
  const [state, action, pending] = useActionState(cancelCustomerSubscriptionAction, initialState)
  const confirmation = mode === 'immediate' ? 'CANCELAR AHORA' : 'CANCELAR'

  return (
    <section className="card stack backstage-billing-cancellation">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Operación restringida</p>
          <h2>Cancelación administrativa</h2>
          <p className="muted">
            Disponible únicamente para founders autorizados. Cada intento queda registrado y se notifica al contacto de facturación.
          </p>
        </div>
        {canManageBilling ? (
          <span className="status-pill status-pill-danger">Founder autorizado</span>
        ) : (
          <span className="status-pill status-pill-muted">
            <LockKeyhole aria-hidden="true" size={13} /> Restringido
          </span>
        )}
      </div>

      <div className="access-summary-grid">
        <Detail label="Suscripción Stripe" value={subscriptionId ?? 'No vinculada'} mono />
        <Detail label="Contacto" value={billingEmail ?? 'No configurado'} />
        <Detail
          label="Estado"
          value={cancellationScheduled ? 'Cancelación programada' : subscriptionId ? 'Activa' : 'Sin suscripción'}
        />
        <Detail label="Fin del periodo" value={formatDate(currentPeriodEnd)} />
      </div>

      {!canManageBilling ? (
        <div className="locked-panel">
          <strong>Permiso requerido: manage_customer_billing</strong>
          <p className="muted">El rol Admin por sí solo no permite modificar la facturación del cliente.</p>
        </div>
      ) : !subscriptionId ? (
        <p className="muted">No hay una suscripción de Stripe vinculada a esta cuenta.</p>
      ) : cancellationScheduled ? (
        <div className="guided-panel">
          <div>
            <strong>La renovación ya está cancelada.</strong>
            <p className="muted">El servicio continuará activo hasta el final del periodo indicado.</p>
          </div>
        </div>
      ) : (
        <form action={action} className="stack backstage-billing-cancellation-form">
          <input type="hidden" name="account_id" value={accountId} />

          <fieldset className="backstage-billing-mode">
            <legend>Momento de la cancelación</legend>
            <label>
              <input
                checked={mode === 'period_end'}
                name="mode"
                onChange={() => setMode('period_end')}
                type="radio"
                value="period_end"
              />
              <span>
                <strong>Al final del periodo</strong>
                <small>Opción recomendada. Mantiene el servicio ya pagado.</small>
              </span>
            </label>
            <label>
              <input
                checked={mode === 'immediate'}
                name="mode"
                onChange={() => setMode('immediate')}
                type="radio"
                value="immediate"
              />
              <span>
                <strong>Inmediata</strong>
                <small>Interrumpe el acceso al confirmar Stripe.</small>
              </span>
            </label>
          </fieldset>

          <label className="field-label" htmlFor="billing-cancellation-reason">
            Motivo interno
          </label>
          <textarea
            id="billing-cancellation-reason"
            maxLength={500}
            minLength={10}
            name="reason"
            placeholder="Describe quién solicita la baja y por qué se realiza desde Backstage."
            required
            rows={3}
          />

          <label className="field-label" htmlFor="billing-cancellation-confirmation">
            Escribe <strong>{confirmation}</strong> para confirmar
          </label>
          <input
            autoComplete="off"
            id="billing-cancellation-confirmation"
            name="confirmation"
            required
          />

          {mode === 'immediate' ? (
            <p className="form-message form-message-error">
              <AlertTriangle aria-hidden="true" size={16} /> Esta acción cancela el servicio inmediatamente.
            </p>
          ) : null}
          {state.message ? (
            <p className={`form-message ${state.ok ? 'form-message-success' : 'form-message-error'}`} role="status">
              {state.message}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="button-outline button-danger" disabled={pending} type="submit">
              {pending ? 'Procesando...' : mode === 'immediate' ? 'Cancelar ahora' : 'Programar cancelación'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-block">
      <p className="detail-label">{label}</p>
      <p className={`detail-value ${mono ? 'mono' : ''}`}>{value}</p>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'No disponible'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}
