import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { Building2, Edit3, LayoutDashboard, MailPlus } from 'lucide-react'
import Link from 'next/link'
import { CreateTenantForm } from './create-tenant-form'
import { DeleteAccountButton } from './delete-account-button'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [{ data: accounts }, { data: tenants }, { data: invites }, { data: subscriptions }, { data: usageRows }] = await Promise.all([
    admin
      .from('accounts')
      .select('id, name, slug, plan, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('theatres')
      .select('id, account_id, name, slug, plan, created_at'),
    admin
      .from('signup_invites')
      .select('account_id, theatre_id, accepted_at, revoked_at')
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

  const venuesByAccount = new Map<string, NonNullable<typeof tenants>>()
  ;(tenants ?? []).forEach((tenant) => {
    const current = venuesByAccount.get(tenant.account_id) ?? []
    current.push(tenant)
    venuesByAccount.set(tenant.account_id, current)
  })

  const inviteCounts = new Map<string, { pending: number; accepted: number }>()
  ;(invites ?? []).forEach((invite) => {
    const current = inviteCounts.get(invite.account_id) ?? { pending: 0, accepted: 0 }
    if (invite.accepted_at) current.accepted += 1
    else if (!invite.revoked_at) current.pending += 1
    inviteCounts.set(invite.account_id, current)
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
          <p className="eyebrow">Accounts</p>
          <h2>Cuentas cliente</h2>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Plan</th>
            <th>Centros</th>
            <th>Uso chatbot</th>
            <th>Invitaciones</th>
            <th>Creado</th>
            <th className="table-actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(accounts ?? []).map((account) => {
            const accountVenues = venuesByAccount.get(account.id) ?? []
            const counts = inviteCounts.get(account.id) ?? { pending: 0, accepted: 0 }
            const usage = accountVenues.reduce(
              (total, tenant) => {
                const tenantUsage = usageByTenant.get(tenant.id) ?? { conversations: 0, estimatedCostCents: 0 }
                total.conversations += tenantUsage.conversations
                total.estimatedCostCents += tenantUsage.estimatedCostCents
                return total
              },
              { conversations: 0, estimatedCostCents: 0 }
            )
            const included = accountVenues.reduce((total, tenant) => {
              const subscription = subscriptionByTenant.get(tenant.id)
              return total + (subscription?.included_chat_conversations ?? 0)
            }, 0)
            const usageLabel = included > 0
              ? `${usage.conversations} / ${included}`
              : `${usage.conversations}`
            const firstVenue = accountVenues[0]

            return (
              <tr key={account.id}>
                <td>
                  <strong>{account.name}</strong>
                  <p className="muted mono">{account.id}</p>
                </td>
                <td>{account.plan}</td>
                <td>{accountVenues.length}</td>
                <td>
                  {usageLabel}
                  <p className="muted">{formatCurrency(usage.estimatedCostCents)}</p>
                </td>
                <td>{counts.pending} pendientes · {counts.accepted} aceptadas</td>
                <td>{new Date(account.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                  <div className="table-actions">
                    <IconAction href={`/backstage/accounts/${account.id}`} label="Ver cuenta">
                      <Building2 aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                    {firstVenue ? (
                      <IconAction href={`/${firstVenue.id}/overview`} label="Ver dashboard">
                        <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    ) : null}
                    {firstVenue ? (
                      <IconAction href={`/backstage/tenants/${firstVenue.id}`} label="Editar primer centro">
                        <Edit3 aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    ) : null}
                    {firstVenue ? (
                      <IconAction href={`/backstage/tenants/${firstVenue.id}/invites`} label="Gestionar invitaciones">
                        <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    ) : null}
                    <DeleteAccountButton accountId={account.id} accountName={account.name} iconOnly />
                  </div>
                </td>
              </tr>
            )
          })}
          {(accounts ?? []).length === 0 ? (
            <tr>
              <td colSpan={7}>
                <p className="muted">Aún no hay cuentas cliente.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="section-title-row">
        <div>
          <p className="eyebrow">Centros</p>
          <h2>Últimos centros</h2>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Centro</th>
            <th>Account</th>
            <th>Plan</th>
            <th>Creado</th>
            <th className="table-actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).slice(0, 10).map((tenant) => {
            const account = (accounts ?? []).find((item) => item.id === tenant.account_id)

            return (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.name}</strong>
                  <p className="muted mono">{tenant.id}</p>
                </td>
                <td>{account?.name ?? '—'}</td>
                <td>{tenant.plan}</td>
                <td>{new Date(tenant.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                  <div className="table-actions">
                    <IconAction href={`/${tenant.id}/overview`} label="Ver dashboard">
                      <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                    <IconAction href={`/backstage/tenants/${tenant.id}`} label="Editar centro">
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
