import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getMarketingCopy } from '@/lib/i18n/marketing-copy'
import { getLocale } from '@/lib/i18n/dictionaries'
import {
  fetchMetaMarketingBusinesses,
  type MetaMarketingBusiness,
} from '@/lib/marketing/oauth'
import {
  META_MARKETING_OAUTH_COOKIE,
  parsePendingMetaMarketingOAuthSession,
} from '@/lib/marketing/oauth-session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MarketingAssetSelectionForm } from './asset-selection-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function MarketingConnectPage({ params }: Props) {
  const { tenantId } = await params
  const [locale, access, cookieStore] = await Promise.all([
    getLocale(),
    requireTenantProductAccess(tenantId, 'manage_marketing', 'marketing'),
    cookies(),
  ])
  const copy = getMarketingCopy(locale)
  const pendingCookie = cookieStore.get(META_MARKETING_OAUTH_COOKIE)?.value
  if (!pendingCookie) redirect(`/${tenantId}/marketing?meta_error=oauth_session`)

  let session: ReturnType<typeof parsePendingMetaMarketingOAuthSession>
  try {
    session = parsePendingMetaMarketingOAuthSession(pendingCookie)
  } catch {
    redirect(`/${tenantId}/marketing?meta_error=oauth_session`)
  }
  if (session.tenantId !== tenantId || session.userId !== access.userId) {
    redirect(`/${tenantId}/marketing?meta_error=oauth_session`)
  }

  let businesses: MetaMarketingBusiness[] | null = null
  try {
    businesses = await fetchMetaMarketingBusinesses(session.accessToken)
  } catch (error) {
    console.error('[meta-marketing-oauth] asset loading failed', {
      tenantId,
      code: error instanceof Error && /^meta_marketing_[a-z0-9_]+$/.test(error.message)
        ? error.message
        : 'meta_marketing_assets_load_failed',
    })
  }

  if (!businesses) {
    return (
      <MarketingConnectMessage
        tenantId={tenantId}
        title={copy.providerUnavailableTitle}
        description={copy.providerUnavailable}
        backLabel={copy.backToMarketing}
      />
    )
  }

  if (businesses.length === 0) {
    return (
      <MarketingConnectMessage
        tenantId={tenantId}
        title={copy.noBusinessesTitle}
        description={copy.noBusinessesDescription}
        backLabel={copy.backToMarketing}
      />
    )
  }

  return (
    <main className="page-shell marketing-connect-page">
      <MarketingAssetSelectionForm
        businesses={businesses}
        copy={copy}
        tenantId={tenantId}
      />
    </main>
  )
}

function MarketingConnectMessage({
  tenantId,
  title,
  description,
  backLabel,
}: {
  tenantId: string
  title: string
  description: string
  backLabel: string
}) {
  return (
    <main className="page-shell marketing-connect-page">
      <section className="card stack">
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        <Link className="button-outline button-fit" href={`/${tenantId}/marketing`}>
          {backLabel}
        </Link>
      </section>
    </main>
  )
}
