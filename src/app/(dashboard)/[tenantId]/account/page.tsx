import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getIntlLocale } from '@/lib/i18n/config'
import { LocalDateTime } from '@/components/local-date-time'
import { ArrowLeft, Building2, CreditCard, Mail, ShieldCheck, UserRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function AccountPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.account
  const access = await getTenantAccess(tenantId)

  const admin = createAdminClient()
  const [{ data: profile }, { data: theatre }] = await Promise.all([
    admin
      .from('profiles')
      .select('email, created_at')
      .eq('auth_user_id', access.userId)
      .maybeSingle(),
    admin
      .from('theatres')
      .select('name, entity_type, primary_language, created_at, accounts(metadata)')
      .eq('id', tenantId)
      .single(),
  ])

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
            <DetailItem icon={<Mail size={16} />} label={copy.email} value={profile?.email || access.userEmail || '-'} />
            <DetailItem icon={<ShieldCheck size={16} />} label={copy.role} value={copy.roles[access.globalRole]} />
            <DetailItem
              icon={<ShieldCheck size={16} />}
              label={copy.accountPosition}
              value={access.source === 'platform'
                ? copy.accountPositions.support
                : access.accountRole === 'owner'
                  ? copy.accountPositions.owner
                  : copy.accountPositions.member}
            />
            <DetailItem
              icon={<UserRound size={16} />}
              label={copy.createdAt}
              value={profile?.created_at
                ? <LocalDateTime value={profile.created_at} locale={getIntlLocale(locale)} dateOnly />
                : '-'}
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
            <DetailItem
              icon={<ShieldCheck size={16} />}
              label={copy.plan}
              value={getCommercialPlanName(dictionary, theatre?.accounts)}
            />
            <DetailItem icon={<Mail size={16} />} label={copy.baseLanguage} value={(theatre?.primary_language ?? 'es').toUpperCase()} />
          </div>
        </section>
      </div>

      <section className="card guided-panel">
        <div>
          <p className="eyebrow">{copy.billing}</p>
          <h2>{copy.billingTitle}</h2>
          <p className="muted">{copy.billingDescription}</p>
        </div>
        <Link className="button-outline" href={`/${tenantId}/upgrade`}>
          <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
          {copy.manageBilling}
        </Link>
      </section>

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

function getCommercialPlanName(
  dictionary: Awaited<ReturnType<typeof getDictionary>>,
  accountRelation: unknown,
) {
  const account = Array.isArray(accountRelation) ? accountRelation[0] : accountRelation
  const metadata = account && typeof account === 'object' && !Array.isArray(account)
    ? (account as { metadata?: unknown }).metadata
    : null
  const planKey = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as { commercial_plan?: unknown }).commercial_plan
    : null

  if (planKey === 'premium' || planKey === 'chatbot_email') return dictionary.upgrade.plans.premium.title
  return dictionary.upgrade.plans.basic.title
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
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

function formatEntityType(copy: Awaited<ReturnType<typeof getDictionary>>['account'], type?: string | null) {
  return copy.entityTypes[type as keyof typeof copy.entityTypes] ?? copy.entityTypes.other
}
