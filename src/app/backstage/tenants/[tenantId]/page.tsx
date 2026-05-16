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
  const [{ data: client }, { data: modules }, { data: emailConnections }, subscriptionResult, usageResult] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, entity_type, primary_language, plan, website_url, fallback_email, fallback_phone, n8n_webhook_url, system_prompt, scrape_urls, widget_config, voice_phone_number, voice_phone_provider, voice_phone_mode, voice_public_phone_number, voice_forwarding_notes, voice_operational_status')
      .eq('id', tenantId)
      .single(),
    admin
      .from('tenant_modules')
      .select('module_key, status')
      .eq('theatre_id', tenantId),
    admin
      .from('email_connections')
      .select('id, provider, mailbox_email, status, sync_mode, draft_mode, error_message, metadata')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1),
    getActiveSubscription(admin, tenantId),
    getTenantUsageForPeriod(admin, tenantId),
  ])

  if (!client) notFound()

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usage = usageResult.ok ? usageResult.usage : null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = usage?.conversations ?? 0
  const chatPercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : 0
  const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a clientes</Link>

      <header className="page-header backstage-venue-header">
        <div>
          <p className="eyebrow">Venue</p>
          <h2>{client.name}</h2>
          <p className="muted mono">{client.id}</p>
        </div>
        <div className="header-actions">
          <IconAction href={`/${client.id}/overview`} label="Ver dashboard" newTab>
            <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
          </IconAction>
          <IconAction href={`/backstage/tenants/${client.id}/invites`} label="Gestionar invitaciones">
            <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
          </IconAction>
        </div>
      </header>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Consumo</p>
            <h2>Uso del plan</h2>
          </div>
          <span className="status-pill status-pill-active">{subscription?.status ?? 'sin periodo'}</span>
        </div>

        <div className="usage-plan-compact-card">
          <div className="usage-plan-main">
            <div className="usage-plan-main-row">
              <div>
                <p className="eyebrow">Chatbot</p>
                <strong className="usage-value usage-value-compact">
                  {chatLimit > 0 ? `${chatUsed} / ${chatLimit}` : `${chatUsed}`}
                </strong>
              </div>
              <span className="plan-usage-percent">{chatPercent}%</span>
            </div>
            <div className="progress-track plan-usage-track">
              <div className="progress-fill" style={{ width: `${chatPercent}%` }} />
            </div>
            <p className="muted">Plan {subscription?.plan ?? client.plan} · periodo {subscription?.billing_period_start ?? '—'} → {subscription?.billing_period_end ?? '—'}</p>
          </div>

          <dl className="usage-plan-side">
            <div>
              <dt>Coste IA estimado</dt>
              <dd>{formatCurrency(usage?.estimatedCostCents ?? 0)}</dd>
            </div>
            <div>
              <dt>Tokens IA</dt>
              <dd>{formatTokens(totalTokens)}</dd>
              <small>{formatTokens(usage?.inputTokens ?? 0)} entrada · {formatTokens(usage?.outputTokens ?? 0)} salida</small>
            </div>
          </dl>
        </div>
      </section>

      <EditClientForm client={client} modules={modules ?? []} emailConnection={emailConnections?.[0] ?? null} />
    </div>
  )
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function IconAction({ href, label, children, newTab = false }: { href: string; label: string; children: React.ReactNode; newTab?: boolean }) {
  return (
    <span className="tooltip-wrap">
      <Link className="icon-button" href={href} aria-label={label} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
