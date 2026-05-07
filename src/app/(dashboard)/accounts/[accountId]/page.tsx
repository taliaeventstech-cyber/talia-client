import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserVenueAccess } from '@/lib/auth/user-venues'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { ArrowLeft, Building2, LayoutDashboard, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ accountId: string }>
}

export default async function AccountDashboardPage({ params }: Props) {
  const { accountId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: platformAdmin }, accessibleVenues, { data: account }, { data: accountTheatres }] = await Promise.all([
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle(),
    getUserVenueAccess(admin, user.id),
    admin
      .from('accounts')
      .select('id, name, slug, billing_email, status')
      .eq('id', accountId)
      .single(),
    admin
      .from('theatres')
      .select('id, name, slug, account_id')
      .eq('account_id', accountId)
      .order('name', { ascending: true }),
  ])
  const accountVenues = platformAdmin
    ? (accountTheatres ?? []).map((venue) => ({
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      accountId: venue.account_id,
      accountName: account?.name ?? 'Account',
      accountSlug: account?.slug ?? 'account',
      role: 'owner' as const,
    }))
    : accessibleVenues.filter((venue) => venue.accountId === accountId)

  if (!accountVenues.length) redirect('/agora')

  const period = getCurrentBillingPeriod()
  const venueIds = accountVenues.map((venue) => venue.id)
  const [{ data: subscriptions }, { data: usageRows }] = await Promise.all([
    admin
      .from('tenant_subscriptions')
      .select('theatre_id, plan, included_chat_conversations, billing_period_start, billing_period_end')
      .in('theatre_id', venueIds)
      .lte('billing_period_start', period.startDate)
      .gt('billing_period_end', period.startDate),
    admin
      .from('tenant_usage_daily')
      .select('theatre_id, conversations, messages, voice_minutes')
      .in('theatre_id', venueIds)
      .gte('date', period.startDate)
      .lt('date', period.endDate),
  ])

  const subscriptionByVenue = new Map((subscriptions ?? []).map((subscription) => [subscription.theatre_id, subscription]))
  const usageByVenue = new Map<string, { conversations: number; messages: number; voiceMinutes: number }>()

  ;(usageRows ?? []).forEach((row) => {
    const current = usageByVenue.get(row.theatre_id) ?? { conversations: 0, messages: 0, voiceMinutes: 0 }
    current.conversations += row.conversations
    current.messages += row.messages
    current.voiceMinutes += Number(row.voice_minutes ?? 0)
    usageByVenue.set(row.theatre_id, current)
  })

  const totals = accountVenues.reduce(
    (acc, venue) => {
      const usage = usageByVenue.get(venue.id) ?? { conversations: 0, messages: 0, voiceMinutes: 0 }
      const subscription = subscriptionByVenue.get(venue.id)
      acc.conversations += usage.conversations
      acc.messages += usage.messages
      acc.voiceMinutes += usage.voiceMinutes
      acc.included += subscription?.included_chat_conversations ?? 0
      return acc
    },
    { conversations: 0, messages: 0, voiceMinutes: 0, included: 0 }
  )

  const chatUsagePercent = totals.included > 0
    ? Math.min(100, Math.round((totals.conversations / totals.included) * 100))
    : null

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          {platformAdmin ? (
            <Link className="back-link" href="/backstage">
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Volver al backstage
            </Link>
          ) : null}
          <p className="eyebrow">Account dashboard</p>
          <h1>{account?.name ?? accountVenues[0].accountName}</h1>
          
        </div>
        <div className="account-header-meta">
          <div className="account-header-meta-actions">
            <span className="status-pill status-pill-active">{account?.status ?? 'active'}</span>
          </div>
          <div className="account-header-facts">
            <div>
              <span>Venues</span>
              <strong>{accountVenues.length}</strong>
            </div>
            <div>
              <span>Conversaciones</span>
              <strong>{totals.included > 0 ? `${totals.conversations}/${totals.included}` : totals.conversations}</strong>
            </div>
            <div>
              <span>Mensajes</span>
              <strong>{totals.messages}</strong>
            </div>
            <div>
              <span>Facturación</span>
              <strong>{account?.billing_email ?? '-'}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2>Actividad del account</h2>
          </div>
          <MessagesSquare className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="overview-grid">
          <SummaryMetric label="Venues activas" value={accountVenues.length} />
          <SummaryMetric label="Conversaciones chatbot" value={totals.conversations} />
          <SummaryMetric label="Mensajes" value={totals.messages} />
          <SummaryMetric label="Minutos voz" value={totals.voiceMinutes.toFixed(1)} />
        </div>
        {chatUsagePercent === null ? null : (
          <div className="stack">
            <div className="plan-usage-compact">
              <span className="mini-stat-label">Uso agregado chatbot</span>
              <span className="plan-usage-percent">{chatUsagePercent}%</span>
            </div>
            <div className="progress-track plan-usage-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${chatUsagePercent}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Venues</p>
            <h2>Dashboards operativos</h2>
          </div>
          <Building2 className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Venue</th>
              <th>Plan</th>
              <th>Conversaciones</th>
              <th>Mensajes</th>
              <th className="table-actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accountVenues.map((venue) => {
              const usage = usageByVenue.get(venue.id) ?? { conversations: 0, messages: 0, voiceMinutes: 0 }
              const subscription = subscriptionByVenue.get(venue.id)
              const included = subscription?.included_chat_conversations ?? 0

              return (
                <tr key={venue.id}>
                  <td>
                    <strong>{venue.name}</strong>
                    <p className="muted mono">{venue.id}</p>
                  </td>
                  <td>{subscription?.plan ?? 'essential'}</td>
                  <td>{included > 0 ? `${usage.conversations} / ${included}` : usage.conversations}</td>
                  <td>{usage.messages}</td>
                  <td>
                    <div className="table-actions">
                      <IconAction href={`/${venue.id}/overview`} label="Ver dashboard" newTab>
                        <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kpi-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

function IconAction({ href, label, children, newTab = false }: { href: string; label: string; children: React.ReactNode; newTab?: boolean }) {
  return (
    <span className="tooltip-wrap tooltip-wrap-right">
      <Link className="icon-button" href={href} aria-label={label} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
