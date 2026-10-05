import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getMarketingCopy } from '@/lib/i18n/marketing-copy'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getMetaMarketingConnectionSummary } from '@/lib/marketing/connection-service'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MetaMarketingConnectionSummary } from '@/types/marketing'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ meta_connected?: string; meta_error?: string }>
}

export default async function MarketingPage({ params, searchParams }: Props) {
  const [{ tenantId }, query, locale, access] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    params.then(({ tenantId: resolvedTenantId }) => (
      requireTenantProductAccess(resolvedTenantId, 'manage_marketing', 'marketing')
    )),
  ])
  const copy = getMarketingCopy(locale)
  const connection = await getMetaMarketingConnectionSummary(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })
  const presentation = getConnectionPresentation(connection, copy)

  return (
    <main className="page-shell marketing-page">
      <header className="page-header marketing-header">
        <div>
          <p className="section-label">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.description}</p>
        </div>
      </header>

      {query.meta_connected === '1' ? (
        <p className="notice notice-success" role="status">{copy.connectedNotice}</p>
      ) : null}
      {query.meta_error ? (
        <p className="notice notice-error" role="alert">
          {getOAuthErrorMessage(query.meta_error, copy)}
        </p>
      ) : null}

      <section className="card stack marketing-connection-card">
        <div className="section-title-row">
          <div>
            <p className="section-label">{copy.status}</p>
            <strong>{presentation.label}</strong>
          </div>
          <div className="marketing-statuses">
            <span className={`status-pill ${presentation.className}`}>
              {presentation.label}
            </span>
            {connection ? (
              <span className={`status-pill ${connection.rollout_enabled ? 'status-pill-active' : 'status-pill-soon'}`}>
                {connection.rollout_enabled ? copy.rolloutReady : copy.rolloutPaused}
              </span>
            ) : null}
          </div>
        </div>

        {connection ? (
          <dl className="marketing-connection-metadata">
            <dt>{copy.business}</dt>
            <dd>{connection.business_name ?? connection.business_id}</dd>
            <dt>{copy.adAccount}</dt>
            <dd>{connection.ad_account_name ?? connection.ad_account_id}</dd>
            <dt>{copy.currency}</dt>
            <dd>{connection.ad_account_currency ?? '—'}</dd>
            <dt>{copy.permissions}</dt>
            <dd>{connection.scopes.join(', ')}</dd>
          </dl>
        ) : null}

        <a
          className={`${connection ? 'button-outline' : 'button-primary'} button-fit`}
          href={`/api/marketing/meta/connect?tenantId=${encodeURIComponent(tenantId)}`}
        >
          {connection ? copy.reconnectMeta : copy.connectMeta}
        </a>

        <p className="notice notice-info" role="status">{copy.guardrail}</p>
      </section>

      <section className="card stack marketing-requirements-card">
        <div>
          <p className="section-label">MVP</p>
          <h2>{copy.requirements}</h2>
        </div>
        <ul className="marketing-requirements-list">
          <li><code>ads_read</code><span>{copy.adsRead}</span></li>
          <li><code>ads_management</code><span>{copy.adsManagement}</span></li>
          <li><code>business_management</code><span>{copy.businessManagement}</span></li>
          <li><strong>Meta</strong><span>{copy.review}</span></li>
        </ul>
      </section>
    </main>
  )
}

function getOAuthErrorMessage(code: string, copy: ReturnType<typeof getMarketingCopy>) {
  if (code === 'oauth_config') return copy.oauthConfigError
  if (code === 'oauth_session') return copy.oauthSessionError
  return copy.oauthFailed
}

function getConnectionPresentation(
  connection: MetaMarketingConnectionSummary | null,
  copy: ReturnType<typeof getMarketingCopy>,
) {
  if (!connection) return { label: copy.disconnected, className: 'status-pill-muted' }
  if (connection.status === 'connected') return { label: copy.connected, className: 'status-pill-active' }
  if (connection.status === 'error') return { label: copy.error, className: 'status-pill-danger' }
  if (connection.status === 'revoked') return { label: copy.revoked, className: 'status-pill-danger' }
  return { label: copy.disabled, className: 'status-pill-muted' }
}
