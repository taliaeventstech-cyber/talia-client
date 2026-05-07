import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { Edit3, LayoutDashboard, MailPlus } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteAccountButton } from '../../delete-account-button'
import { CreateVenueForm } from './create-venue-form'

interface Props {
  params: Promise<{ accountId: string }>
}

export default async function BackstageAccountPage({ params }: Props) {
  const { accountId } = await params
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [{ data: account }, { data: venues }, { data: memberships }, { data: subscriptions }, { data: usageRows }] = await Promise.all([
    admin
      .from('accounts')
      .select('id, name, slug, billing_email, plan, status, created_at')
      .eq('id', accountId)
      .single(),
    admin
      .from('theatres')
      .select('id, name, slug, entity_type, primary_language, plan, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
    admin
      .from('account_memberships')
      .select('role, revoked_at, profiles(email, full_name)')
      .eq('account_id', accountId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
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

  if (!account) notFound()

  const subscriptionByTenant = new Map((subscriptions ?? []).map((subscription) => [subscription.theatre_id, subscription]))
  const usageByTenant = new Map<string, { conversations: number; estimatedCostCents: number }>()
  ;(usageRows ?? []).forEach((row) => {
    const current = usageByTenant.get(row.theatre_id) ?? { conversations: 0, estimatedCostCents: 0 }
    current.conversations += row.conversations
    current.estimatedCostCents += row.estimated_cost_cents
    usageByTenant.set(row.theatre_id, current)
  })

  const totals = (venues ?? []).reduce(
    (acc, venue) => {
      const usage = usageByTenant.get(venue.id) ?? { conversations: 0, estimatedCostCents: 0 }
      const subscription = subscriptionByTenant.get(venue.id)
      acc.conversations += usage.conversations
      acc.estimatedCostCents += usage.estimatedCostCents
      acc.included += subscription?.included_chat_conversations ?? 0
      return acc
    },
    { conversations: 0, estimatedCostCents: 0, included: 0 }
  )

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a backstage</Link>

      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{account.name}</h2>
          <p className="muted mono">{account.id}</p>
        </div>
        <div className="header-actions">
          <span className="status-pill status-pill-active">{account.status}</span>
          <DeleteAccountButton accountId={account.id} accountName={account.name} />
        </div>
      </header>

      <section className="card stack">
        <div className="overview-grid">
          <DetailBlock label="Plan" value={account.plan} />
          <DetailBlock label="Billing email" value={account.billing_email ?? '—'} />
          <DetailBlock label="Centros" value={String(venues?.length ?? 0)} />
          <DetailBlock
            label="Uso chatbot"
            value={totals.included > 0 ? `${totals.conversations} / ${totals.included}` : String(totals.conversations)}
          />
        </div>
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Venues</p>
            <h2>Centros asociados</h2>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Centro</th>
              <th>Tipo</th>
              <th>Idioma</th>
              <th>Uso chatbot</th>
              <th className="table-actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(venues ?? []).map((venue) => {
              const usage = usageByTenant.get(venue.id) ?? { conversations: 0, estimatedCostCents: 0 }
              const subscription = subscriptionByTenant.get(venue.id)
              const included = subscription?.included_chat_conversations ?? 0

              return (
                <tr key={venue.id}>
                  <td>
                    <strong>{venue.name}</strong>
                    <p className="muted mono">{venue.id}</p>
                  </td>
                  <td>{venue.entity_type}</td>
                  <td>{venue.primary_language}</td>
                  <td>
                    {included > 0 ? `${usage.conversations} / ${included}` : usage.conversations}
                    <p className="muted">{formatCurrency(usage.estimatedCostCents)}</p>
                  </td>
                  <td>
                    <div className="table-actions">
                      <IconAction href={`/${venue.id}/overview`} label="Ver dashboard">
                        <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                      <IconAction href={`/backstage/tenants/${venue.id}`} label="Editar centro">
                        <Edit3 aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                      <IconAction href={`/backstage/tenants/${venue.id}/invites`} label="Gestionar invitaciones">
                        <MailPlus aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Accesos</p>
            <h2>Usuarios del account</h2>
          </div>
        </div>

        {(memberships ?? []).length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol account</th>
              </tr>
            </thead>
            <tbody>
              {(memberships ?? []).map((membership, index) => {
                const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles

                return (
                  <tr key={`${profile?.email ?? 'member'}-${index}`}>
                    <td>{profile?.email ?? '—'}</td>
                    <td>{profile?.full_name ?? '—'}</td>
                    <td>{membership.role}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aún no hay usuarios vinculados a este account.</p>
        )}
      </section>

      <CreateVenueForm accountId={account.id} />
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-block">
      <p className="detail-label">{label}</p>
      <p className="detail-value">{value}</p>
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
