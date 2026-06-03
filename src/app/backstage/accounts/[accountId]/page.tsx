import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { Edit3, LayoutDashboard, MailPlus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteInviteAction } from '../../actions'
import { AccountHeaderActions } from './account-header-actions'
import { AccountTabs } from './account-tabs'
import { CreateAccountInviteForm } from './create-account-invite-form'
import { CreateVenueForm } from './create-venue-form'

interface Props {
  params: Promise<{ accountId: string }>
  searchParams?: Promise<{ tab?: string }>
}

export default async function BackstageAccountPage({ params, searchParams }: Props) {
  const { accountId } = await params
  const query = await searchParams
  const initialTab = isAccountTab(query?.tab) ? query.tab : 'venues'
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [
    { data: account },
    { data: venues },
    { data: memberships },
    { data: venueMemberships },
    { data: invites },
    { data: subscriptions },
    { data: usageRows },
  ] = await Promise.all([
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
      .select('id, profile_id, role, revoked_at, profiles(email, full_name)')
      .eq('account_id', accountId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('venue_memberships')
      .select('profile_id, theatre_id, role, revoked_at')
      .is('revoked_at', null),
    admin
      .from('signup_invites')
      .select('id, email, role, theatre_id, expires_at, accepted_at, revoked_at, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('tenant_subscriptions')
      .select('theatre_id, plan, included_chat_conversations, billing_period_start, billing_period_end')
      .lte('billing_period_start', period.startDate)
      .gt('billing_period_end', period.startDate),
    admin
      .from('tenant_usage_daily')
      .select('theatre_id, conversations, input_tokens, output_tokens, estimated_cost_cents')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .eq('channel', 'chatbot'),
  ])

  if (!account) notFound()

  const venueIds = (venues ?? []).map((venue) => venue.id)
  const { data: modules } = venueIds.length
    ? await admin
      .from('tenant_modules')
      .select('theatre_id, module_key, status')
      .in('theatre_id', venueIds)
      .in('status', ['trial', 'active'])
    : { data: [] }

  const subscriptionByTenant = new Map((subscriptions ?? []).map((subscription) => [subscription.theatre_id, subscription]))
  const venueById = new Map((venues ?? []).map((venue) => [venue.id, venue]))
  const modulesByTenant = new Map<string, string[]>()
  ;(modules ?? []).forEach((module) => {
    const current = modulesByTenant.get(module.theatre_id) ?? []
    current.push(module.module_key)
    modulesByTenant.set(module.theatre_id, current)
  })
  const usageByTenant = new Map<string, { conversations: number; inputTokens: number; outputTokens: number; estimatedCostCents: number }>()
  ;(usageRows ?? []).forEach((row) => {
    const current = usageByTenant.get(row.theatre_id) ?? { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
    current.conversations += row.conversations
    current.inputTokens += row.input_tokens
    current.outputTokens += row.output_tokens
    current.estimatedCostCents += row.estimated_cost_cents
    usageByTenant.set(row.theatre_id, current)
  })

  const pendingInvites = (invites ?? []).filter((invite) => getInviteStatus(invite).label === 'Pendiente').length
  const acceptedInvites = (invites ?? []).filter((invite) => getInviteStatus(invite).label === 'Aceptada').length

  return (
    <div className="stack">
      <Link className="back-link" href="/backstage">Volver a Clientes</Link>

      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{account.name}</h2>
          <p className="muted mono">{account.id}</p>
        </div>
        <div className="header-actions">
          <span className="status-pill status-pill-active">{account.status}</span>
          <AccountHeaderActions accountId={account.id} accountName={account.name} />
        </div>
      </header>

      <AccountTabs
        initialTab={initialTab}
        venues={(
          <div className="stack">
            <section className="card stack">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Venues</p>
                  <h2>Venues asociadas</h2>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Tipo</th>
                    <th>Plan</th>
                    <th>Idioma</th>
                    <th>Uso chatbot</th>
                    <th className="table-actions-heading">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(venues ?? []).map((venue) => {
                    const usage = usageByTenant.get(venue.id) ?? { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
                    const subscription = subscriptionByTenant.get(venue.id)
                    const included = subscription?.included_chat_conversations ?? 0

                    return (
                      <tr key={venue.id}>
                        <td>
                          <strong>{venue.name}</strong>
                          <p className="muted mono">{venue.id}</p>
                        </td>
                        <td>{venue.entity_type}</td>
                        <td>{venue.plan}</td>
                        <td>{venue.primary_language}</td>
                        <td>
                          {included > 0 ? `${usage.conversations} / ${included}` : usage.conversations}
                          <p className="muted">{formatCurrency(usage.estimatedCostCents)} · {formatTokens(usage.inputTokens + usage.outputTokens)} tokens</p>
                        </td>
                        <td>
                          <div className="table-actions">
                            <IconAction href={`/${venue.id}/overview`} label="Ver dashboard" newTab>
                              <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                            </IconAction>
                            <IconAction href={`/backstage/tenants/${venue.id}`} label="Editar venue">
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
                  {(venues ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <p className="muted">Este cliente aún no tiene venues. Usa el botón flotante para añadir la primera.</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>

            <CreateVenueForm accountId={account.id} />
          </div>
        )}
        users={(
          <div className="stack">
            <section className="card stack account-access-panel">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Accesos</p>
                  <h2>Usuarios e invitaciones</h2>
                  <p className="muted">
                    Gestiona quién puede entrar al account y desde qué venue empieza su acceso.
                  </p>
                </div>
              </div>

              <div className="access-summary-grid">
                <DetailBlock label="Usuarios activos" value={String(memberships?.length ?? 0)} />
                <DetailBlock label="Invitaciones pendientes" value={String(pendingInvites)} />
                <DetailBlock label="Invitaciones aceptadas" value={String(acceptedInvites)} />
                <DetailBlock label="Venues disponibles" value={String(venues?.length ?? 0)} />
              </div>

              <CreateAccountInviteForm accountId={account.id} venues={(venues ?? []).map((venue) => ({ id: venue.id, name: venue.name }))} />
            </section>

            <section className="card stack">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Equipo</p>
                  <h2>Usuarios activos</h2>
                </div>
              </div>

              {(memberships ?? []).length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nombre</th>
                      <th>Rol account</th>
                      <th>Venues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(memberships ?? []).map((membership, index) => {
                      const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles
                      const memberVenues = (venueMemberships ?? [])
                        .filter((venueMembership) => venueMembership.profile_id === membership.profile_id)
                        .map((venueMembership) => venueById.get(venueMembership.theatre_id)?.name)
                        .filter(Boolean)

                      return (
                        <tr key={`${profile?.email ?? 'member'}-${index}`}>
                          <td>{profile?.email ?? '—'}</td>
                          <td>{profile?.full_name ?? '—'}</td>
                          <td>{membership.role}</td>
                          <td>{memberVenues.length ? memberVenues.join(', ') : 'Todas las venues del account'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Aún no hay usuarios vinculados a este account.</p>
              )}
            </section>

            <section className="card stack">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Invitaciones</p>
                  <h2>Historial y estado</h2>
                </div>
              </div>

              {(invites ?? []).length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Alcance</th>
                      <th>Estado</th>
                      <th>Caduca</th>
                      <th className="table-actions-heading">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invites ?? []).map((invite) => {
                      const status = getInviteStatus(invite)

                      return (
                        <tr key={invite.id}>
                          <td>
                            <strong>{invite.email}</strong>
                            <p className="muted">Creada {new Date(invite.created_at).toLocaleDateString('es-ES')}</p>
                          </td>
                          <td>{formatRole(invite.role)}</td>
                          <td>{invite.theatre_id ? venueById.get(invite.theatre_id)?.name ?? 'Venue concreta' : 'Todo el account'}</td>
                          <td><span className={`status-pill ${status.className}`}>{status.label}</span></td>
                          <td>{new Date(invite.expires_at).toLocaleDateString('es-ES')}</td>
                          <td>
                            <div className="table-actions">
                              <form action={deleteInviteAction}>
                                <input type="hidden" name="account_id" value={account.id} />
                                <input type="hidden" name="invite_id" value={invite.id} />
                                <button className="icon-button icon-button-danger" type="submit" aria-label={`Borrar invitación de ${invite.email}`}>
                                  <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Aún no hay invitaciones para este account.</p>
              )}
            </section>
          </div>
        )}
        plan={(
          <section className="card stack">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Plan y módulos</p>
                <h2>Configuración por venue</h2>
                <p className="muted">
                  Cada venue mantiene su propio plan, módulos y límites. No se agregan planes a nivel account.
                </p>
              </div>
            </div>
            {(venues ?? []).length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Plan</th>
                    <th>Módulos activos</th>
                    <th>Límite chatbot</th>
                    <th>Uso actual</th>
                    <th className="table-actions-heading">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(venues ?? []).map((venue) => {
                    const subscription = subscriptionByTenant.get(venue.id)
                    const usage = usageByTenant.get(venue.id) ?? { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
                    const activeModules = modulesByTenant.get(venue.id) ?? []
                    const included = subscription?.included_chat_conversations ?? 0

                    return (
                      <tr key={venue.id}>
                        <td>
                          <strong>{venue.name}</strong>
                          <p className="muted mono">{venue.id}</p>
                        </td>
                        <td>{formatPlan(subscription?.plan ?? venue.plan)}</td>
                        <td>
                          <div className="module-pill-list">
                            {activeModules.length ? activeModules.map((moduleKey) => (
                              <span className="module-pill" key={`${venue.id}-${moduleKey}`}>
                                {formatModule(moduleKey)}
                              </span>
                            )) : <span className="muted">Sin módulos activos</span>}
                          </div>
                        </td>
                        <td>{included > 0 ? `${included} conversaciones/mes` : 'Sin límite configurado'}</td>
                        <td>
                          {included > 0 ? `${usage.conversations} / ${included}` : usage.conversations}
                          <p className="muted">{formatTokens(usage.inputTokens + usage.outputTokens)} tokens</p>
                        </td>
                        <td>
                          <div className="table-actions">
                            <IconAction href={`/backstage/tenants/${venue.id}`} label="Editar plan y módulos">
                              <Edit3 aria-hidden="true" size={16} strokeWidth={2} />
                            </IconAction>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="muted">Añade una venue para configurar su plan y módulos.</p>
            )}
          </section>
        )}
        activity={(
          <section className="card stack">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Actividad</p>
                <h2>Registro operativo</h2>
                <p className="muted">
                  Próximamente mostraremos cambios de configuración, altas, bajas y actividad administrativa.
                </p>
              </div>
            </div>
            <p className="muted">Sin eventos adicionales por ahora.</p>
          </section>
        )}
      />
    </div>
  )
}

function isAccountTab(value: string | undefined): value is 'venues' | 'users' | 'plan' | 'activity' {
  return value === 'venues' || value === 'users' || value === 'plan' || value === 'activity'
}

function getInviteStatus(invite: { accepted_at: string | null; revoked_at: string | null; expires_at: string }) {
  if (invite.accepted_at) return { label: 'Aceptada', className: 'status-pill-active' }
  if (invite.revoked_at) return { label: 'Desactivada', className: 'status-pill-danger' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { label: 'Caducada', className: 'status-pill-muted' }
  return { label: 'Pendiente', className: 'status-pill-soon' }
}

function formatRole(role: string) {
  const labels: Record<string, string> = {
    owner: 'Owner account',
    admin: 'Admin',
    operator: 'Operador atención',
    analyst: 'Analista data',
    viewer: 'Solo lectura',
  }

  return labels[role] ?? role
}

function formatPlan(plan: string | null | undefined) {
  const labels: Record<string, string> = {
    essential: 'Esencial',
    professional: 'Profesional',
    enterprise: 'Enterprise',
    custom: 'Custom',
  }

  return labels[plan ?? ''] ?? plan ?? 'Sin plan'
}

function formatModule(moduleKey: string) {
  const labels: Record<string, string> = {
    chatbot: 'Chatbot',
    data: 'Data',
    voice: 'Voz',
    email: 'Email',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    marketing: 'Marketing',
  }

  return labels[moduleKey] ?? moduleKey
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

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
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
