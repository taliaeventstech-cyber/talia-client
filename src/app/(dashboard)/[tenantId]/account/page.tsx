import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { ArrowLeft, Building2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function AccountPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.account
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: membership }, { data: theatre }] = await Promise.all([
    admin
      .from('users')
      .select('email, role, created_at')
      .eq('id', user.id)
      .eq('theatre_id', tenantId)
      .single(),
    admin
      .from('theatres')
      .select('name, entity_type, plan, primary_language, created_at')
      .eq('id', tenantId)
      .single(),
  ])

  if (!membership) redirect('/login')

  return (
    <main className="page-shell">
      <header className="page-header account-page-header">
        <Link className="back-link" href={`/${tenantId}/overview`}>
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          {copy.back}
        </Link>
        <p className="eyebrow">{copy.section}</p>
        <h1>{copy.title}</h1>
        <p className="muted">
          {copy.description}
        </p>
      </header>

      <div className="account-grid">
        <section className="card stack">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{copy.profile}</p>
              <h2>{copy.accessData}</h2>
            </div>
            <UserRound className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>

          <div className="detail-list">
            <DetailItem icon={<Mail size={16} />} label={copy.email} value={membership.email || user.email || '-'} />
            <DetailItem icon={<ShieldCheck size={16} />} label={copy.role} value={formatRole(copy, membership.role)} />
            <DetailItem
              icon={<UserRound size={16} />}
              label={copy.createdAt}
              value={new Date(membership.created_at).toLocaleDateString(locale === 'ca' ? 'ca-ES' : 'es-ES')}
            />
          </div>
        </section>

        <section className="card stack">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{copy.organization}</p>
              <h2>{theatre?.name ?? 'Tenant'}</h2>
            </div>
            <Building2 className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>

          <div className="detail-list">
            <DetailItem icon={<Building2 size={16} />} label={copy.type} value={formatEntityType(copy, theatre?.entity_type)} />
            <DetailItem icon={<ShieldCheck size={16} />} label={copy.plan} value={theatre?.plan ?? 'demo'} />
            <DetailItem icon={<Mail size={16} />} label={copy.baseLanguage} value={(theatre?.primary_language ?? 'es').toUpperCase()} />
          </div>
        </section>
      </div>

      <section className="card guided-panel">
        <div>
          <p className="eyebrow">{copy.next}</p>
          <h2>{copy.teamTitle}</h2>
          <p className="muted">
            {copy.teamDescription}
          </p>
        </div>
        <span className="status-pill status-pill-soon">{copy.next}</span>
      </section>
    </main>
  )
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="detail-item">
      <span className="detail-icon" aria-hidden="true">{icon}</span>
      <div>
        <p className="detail-label">{label}</p>
        <p className="detail-value">{value}</p>
      </div>
    </div>
  )
}

function formatRole(copy: Awaited<ReturnType<typeof getDictionary>>['account'], role: string) {
  return copy.roles[role as keyof typeof copy.roles] ?? copy.roles.viewer
}

function formatEntityType(copy: Awaited<ReturnType<typeof getDictionary>>['account'], type?: string | null) {
  return copy.entityTypes[type as keyof typeof copy.entityTypes] ?? copy.entityTypes.other
}
