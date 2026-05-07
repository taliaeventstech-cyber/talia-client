import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { Edit3, LayoutDashboard, MailPlus } from 'lucide-react'
import Link from 'next/link'
import { CreateTenantForm } from './create-tenant-form'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [{ data: tenants }, { data: invites }, { data: subscriptions }, { data: usageRows }] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, slug, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('signup_invites')
      .select('theatre_id, accepted_at, revoked_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('tenant_subscriptions')
      .select('theatre_id, plan, included_chat_conversations, billing_period_start, billing_period_end')
      .lte('billing_period_start', period.startDate)
      .gt('billing_period_end', period.startDate),
    admin
      .from('tenant_usage_daily')
      .select('theatre_id, conversations, estimated_cost_cents')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .eq('channel', 'chatbot'),
  ])

  const inviteCounts = new Map<string, { pending: number; accepted: number }>()
  ;(invites ?? []).forEach((invite) => {
    const current = inviteCounts.get(invite.theatre_id) ?? { pending: 0, accepted: 0 }
    if (invite.accepted_at) current.accepted += 1
    else if (!invite.revoked_at) current.pending += 1
    inviteCounts.set(invite.theatre_id, current)
  })

  const subscriptionByTenant = new Map((subscriptions ?? []).map((subscription) => [subscription.theatre_id, subscription]))
  const usageByTenant = new Map<string, { conversations: number; estimatedCostCents: number }>()
  ;(usageRows ?? []).forEach((row) => {
    const current = usageByTenant.get(row.theatre_id) ?? { conversations: 0, estimatedCostCents: 0 }
    current.conversations += row.conversations
    current.estimatedCostCents += row.estimated_cost_cents
    usageByTenant.set(row.theatre_id, current)
  })

  return (
    <div className="stack">
      <CreateTenantForm />

      <div className="section-title-row">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Clientes</h2>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Plan</th>
            <th>Uso chatbot</th>
            <th>Invitaciones</th>
            <th>Creado</th>
            <th className="table-actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((tenant) => {
            const counts = inviteCounts.get(tenant.id) ?? { pending: 0, accepted: 0 }
            const subscription = subscriptionByTenant.get(tenant.id)
            const usage = usageByTenant.get(tenant.id) ?? { conversations: 0, estimatedCostCents: 0 }
            const included = subscription?.included_chat_conversations ?? 0
            const usageLabel = included > 0
              ? `${usage.conversations} / ${included}`
              : `${usage.conversations}`

            return (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.name}</strong>
                  <p className="muted mono">{tenant.slug}</p>
                </td>
                <td>{subscription?.plan ?? tenant.plan}</td>
                <td>
                  {usageLabel}
                  <p className="muted">{formatCurrency(usage.estimatedCostCents)}</p>
                </td>
                <td>{counts.pending} pendientes · {counts.accepted} aceptadas</td>
                <td>{new Date(tenant.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                  <div className="table-actions">
                    <IconAction href={`/${tenant.id}/overview`} label="Ver dashboard">
                      <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                    <IconAction href={`/backstage/tenants/${tenant.id}`} label="Editar cliente">
                      <Edit3 aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                    <IconAction href={`/backstage/tenants/${tenant.id}/invites`} label="Gestionar invitaciones">
                      <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
    <span className="tooltip-wrap tooltip-wrap-right">
      <Link className="icon-button" href={href} aria-label={label}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
