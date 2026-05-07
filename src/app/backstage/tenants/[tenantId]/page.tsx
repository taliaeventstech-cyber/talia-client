import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSubscription, getTenantUsageForPeriod } from '@/lib/usage/service'
import { LayoutDashboard, MailPlus } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EditClientForm } from './edit-client-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function BackstageClientPage({ params }: Props) {
  const { tenantId } = await params
  const admin = createAdminClient()
  const [{ data: client }, { data: modules }, subscriptionResult, usageResult] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, entity_type, primary_language, plan, website_url, fallback_email, fallback_phone')
      .eq('id', tenantId)
      .single(),
    admin
      .from('tenant_modules')
      .select('module_key, status')
      .eq('theatre_id', tenantId),
    getActiveSubscription(admin, tenantId),
    getTenantUsageForPeriod(admin, tenantId),
  ])

  if (!client) notFound()

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usage = usageResult.ok ? usageResult.usage : null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = usage?.conversations ?? 0
  const chatPercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : 0

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a clientes</Link>

      <header className="page-header">
        <p className="eyebrow">Cliente</p>
        <h2>{client.name}</h2>
        <p className="muted mono">{client.slug}</p>
      </header>

      <div className="internal-nav">
        <IconAction href={`/${client.id}/overview`} label="Ver dashboard">
          <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
        </IconAction>
        <IconAction href={`/backstage/tenants/${client.id}/invites`} label="Gestionar invitaciones">
          <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
        </IconAction>
      </div>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Consumo</p>
            <h2>Uso del plan</h2>
          </div>
          <span className="status-pill status-pill-active">{subscription?.status ?? 'sin periodo'}</span>
        </div>

        <div className="usage-plan-grid">
          <div className="usage-meter-card">
            <p className="eyebrow">Chatbot</p>
            <strong className="usage-value">
              {chatLimit > 0 ? `${chatUsed} / ${chatLimit}` : `${chatUsed}`}
            </strong>
            <div className="progress-track progress-track-large">
              <div className="progress-fill" style={{ width: `${chatPercent}%` }} />
            </div>
            <p className="muted">Plan {subscription?.plan ?? client.plan}</p>
          </div>

          <div className="usage-meter-card">
            <p className="eyebrow">Coste IA estimado</p>
            <strong className="usage-value">{formatCurrency(usage?.estimatedCostCents ?? 0)}</strong>
            <p className="muted">Periodo {subscription?.billing_period_start ?? '—'} → {subscription?.billing_period_end ?? '—'}</p>
          </div>
        </div>
      </section>

      <EditClientForm client={client} modules={modules ?? []} />
    </div>
  )
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function IconAction({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <span className="tooltip-wrap">
      <Link className="icon-button" href={href} aria-label={label}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
