import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getMarketingCopy, type MarketingCopy } from '@/lib/i18n/marketing-copy'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import {
  getMetaMarketingConnectionSummary,
  getMetaMarketingDashboardSnapshot,
} from '@/lib/marketing/connection-service'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  MetaMarketingAccountInsight,
  MetaMarketingCampaignSnapshot,
  MetaMarketingConnectionSummary,
  MetaMarketingDashboardSnapshot,
} from '@/types/marketing'
import { MarketingTrendChart } from './marketing-trend-chart'
import { MetaMarketingSyncButton } from './sync-button'

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
  const admin = createAdminClient()
  const [connection, snapshot] = await Promise.all([
    getMetaMarketingConnectionSummary(admin, {
      tenantId,
      actorUserId: access.userId,
    }),
    getMetaMarketingDashboardSnapshot(admin, {
      tenantId,
      actorUserId: access.userId,
    }),
  ])
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

      {connection && snapshot ? (
        <MarketingInsights
          connection={connection}
          copy={copy}
          locale={getIntlLocale(locale)}
          snapshot={snapshot}
          tenantId={tenantId}
        />
      ) : null}

      <ConnectionCard
        connection={connection}
        copy={copy}
        presentation={presentation}
        tenantId={tenantId}
      />

      {!connection ? (
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
      ) : null}
    </main>
  )
}

function MarketingInsights({ connection, copy, locale, snapshot, tenantId }: {
  connection: MetaMarketingConnectionSummary
  copy: MarketingCopy
  locale: string
  snapshot: MetaMarketingDashboardSnapshot
  tenantId: string
}) {
  const currency = connection.ad_account_currency ?? 'EUR'
  const hasSnapshot = snapshot.summary !== null

  return (
    <section className="marketing-insights-section stack">
      <div className="marketing-insights-header">
        <div>
          <p className="section-label">{copy.insightsEyebrow}</p>
          <h2>{copy.insightsTitle}</h2>
          <p className="muted marketing-sync-time">
            {snapshot.last_synced_at ? (
              <>{copy.lastUpdated}{' '}<LocalDateTime value={snapshot.last_synced_at} locale={locale} /></>
            ) : copy.neverSynced}
          </p>
        </div>
        <MetaMarketingSyncButton copy={copy} tenantId={tenantId} />
      </div>

      {snapshot.status === 'error' ? (
        <p className="notice notice-warning" role="status">
          {snapshot.last_synced_at ? copy.staleDataNotice : copy.firstSyncErrorNotice}
        </p>
      ) : null}
      <p className="notice notice-info" role="status">{copy.readOnlyNotice}</p>

      {!hasSnapshot ? (
        <MarketingEmptyState title={copy.neverSyncedTitle} description={copy.neverSyncedDescription} />
      ) : (
        <>
          <MarketingMetrics copy={copy} currency={currency} locale={locale} summary={snapshot.summary!} />
          {snapshot.daily_insights.length > 0 ? (
            <MarketingTrendChart
              currency={currency}
              data={snapshot.daily_insights}
              labels={{
                title: copy.trendTitle,
                description: copy.trendDescription,
                date: copy.date,
                spend: copy.spend,
                linkClicks: copy.linkClicks,
                ctr: copy.ctr,
                accessibleTable: copy.trendAccessibleTable,
              }}
              locale={locale}
            />
          ) : null}
          <MarketingReading
            campaigns={snapshot.campaigns}
            copy={copy}
            currency={currency}
            locale={locale}
            summary={snapshot.summary!}
          />
          {snapshot.campaigns.length === 0 ? (
            <MarketingEmptyState title={copy.noCampaignsTitle} description={copy.noCampaignsDescription} />
          ) : (
            <CampaignTable campaigns={snapshot.campaigns} copy={copy} currency={currency} locale={locale} />
          )}
        </>
      )}
    </section>
  )
}

function MarketingMetrics({ copy, currency, locale, summary }: {
  copy: MarketingCopy
  currency: string
  locale: string
  summary: MetaMarketingAccountInsight
}) {
  const metrics = [
    [copy.spend, formatCurrency(summary.spend, currency, locale)],
    [copy.reach, formatInteger(summary.reach, locale)],
    [copy.impressions, formatInteger(summary.impressions, locale)],
    [copy.linkClicks, formatInteger(summary.link_clicks, locale)],
    [copy.ctr, formatPercentage(summary.ctr, locale)],
    [copy.cpc, summary.cpc === null ? '—' : formatCurrency(summary.cpc, currency, locale)],
    [copy.frequency, formatDecimal(summary.frequency, locale)],
  ]

  return (
    <div className="marketing-metrics-grid">
      {metrics.map(([label, value]) => (
        <article className="marketing-metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{copy.last30Days}</small>
        </article>
      ))}
    </div>
  )
}

function MarketingReading({ campaigns, copy, currency, locale, summary }: {
  campaigns: MetaMarketingCampaignSnapshot[]
  copy: MarketingCopy
  currency: string
  locale: string
  summary: MetaMarketingAccountInsight
}) {
  const topCampaign = [...campaigns].sort((left, right) => right.link_clicks - left.link_clicks)[0]
  const happened = summary.impressions === 0
    ? copy.noDeliveryReading
    : fillTemplate(copy.happenedReading, {
        spend: formatCurrency(summary.spend, currency, locale),
        impressions: formatInteger(summary.impressions, locale),
        reach: formatInteger(summary.reach, locale),
        clicks: formatInteger(summary.link_clicks, locale),
      })
  const works = !topCampaign || topCampaign.link_clicks === 0
    ? copy.noWinnerReading
    : fillTemplate(copy.winnerReading, {
        campaign: topCampaign.name,
        clicks: formatInteger(topCampaign.link_clicks, locale),
      })
  const review = summary.impressions === 0
    ? copy.reviewNoDelivery
    : summary.spend > 0 && summary.link_clicks === 0
      ? copy.reviewNoClicks
      : summary.frequency >= 3
        ? fillTemplate(copy.reviewFrequency, { frequency: formatDecimal(summary.frequency, locale) })
        : copy.reviewHealthy

  return (
    <div className="marketing-reading-grid">
      <article className="marketing-reading-card">
        <span>{copy.whatHappened}</span>
        <p>{happened}</p>
      </article>
      <article className="marketing-reading-card">
        <span>{copy.whatWorks}</span>
        <p>{works}</p>
      </article>
      <article className="marketing-reading-card marketing-reading-card-review">
        <span>{copy.whatReview}</span>
        <p>{review}</p>
      </article>
    </div>
  )
}

function CampaignTable({ campaigns, copy, currency, locale }: {
  campaigns: MetaMarketingCampaignSnapshot[]
  copy: MarketingCopy
  currency: string
  locale: string
}) {
  return (
    <section className="card stack marketing-campaigns-card">
      <div>
        <h2>{copy.campaignsTitle}</h2>
        <p className="muted">{copy.campaignsDescription}</p>
      </div>
      <div className="marketing-campaigns-table-wrap">
        <table className="data-table marketing-campaigns-table">
          <thead>
            <tr>
              <th>{copy.campaign}</th>
              <th>{copy.delivery}</th>
              <th>{copy.spend}</th>
              <th>{copy.reach}</th>
              <th>{copy.linkClicks}</th>
              <th>{copy.ctr}</th>
              <th>{copy.cpc}</th>
              <th>{copy.frequency}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.campaign_id}>
                <td><strong>{campaign.name}</strong></td>
                <td>
                  <span className={`status-pill ${getCampaignStatusClass(campaign.effective_status)}`}>
                    {formatCampaignStatus(campaign.effective_status)}
                  </span>
                </td>
                <td>{formatCurrency(campaign.spend, currency, locale)}</td>
                <td>{formatInteger(campaign.reach, locale)}</td>
                <td>{formatInteger(campaign.link_clicks, locale)}</td>
                <td>{formatPercentage(campaign.ctr, locale)}</td>
                <td>{campaign.cpc === null ? '—' : formatCurrency(campaign.cpc, currency, locale)}</td>
                <td>{formatDecimal(campaign.frequency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MarketingEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="card marketing-insights-empty">
      <div className="marketing-empty-visual" aria-hidden="true">↗</div>
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
    </section>
  )
}

function ConnectionCard({ connection, copy, presentation, tenantId }: {
  connection: MetaMarketingConnectionSummary | null
  copy: MarketingCopy
  presentation: ReturnType<typeof getConnectionPresentation>
  tenantId: string
}) {
  return (
    <section className="card stack marketing-connection-card">
      <div className="section-title-row">
        <div>
          <p className="section-label">{copy.status}</p>
          <strong>{presentation.label}</strong>
        </div>
        <div className="marketing-statuses">
          <span className={`status-pill ${presentation.className}`}>{presentation.label}</span>
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
  )
}

function getOAuthErrorMessage(code: string, copy: MarketingCopy) {
  if (code === 'oauth_config') return copy.oauthConfigError
  if (code === 'oauth_session') return copy.oauthSessionError
  return copy.oauthFailed
}

function getConnectionPresentation(connection: MetaMarketingConnectionSummary | null, copy: MarketingCopy) {
  if (!connection) return { label: copy.disconnected, className: 'status-pill-muted' }
  if (connection.status === 'connected') return { label: copy.connected, className: 'status-pill-active' }
  if (connection.status === 'error') return { label: copy.error, className: 'status-pill-danger' }
  if (connection.status === 'revoked') return { label: copy.revoked, className: 'status-pill-danger' }
  return { label: copy.disabled, className: 'status-pill-muted' }
}

function formatCurrency(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatInteger(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

function formatDecimal(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercentage(value: number, locale: string) {
  return `${formatDecimal(value, locale)}%`
}

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
}

function formatCampaignStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ')
}

function getCampaignStatusClass(value: string) {
  if (value === 'ACTIVE') return 'status-pill-active'
  if (['DISAPPROVED', 'WITH_ISSUES'].includes(value)) return 'status-pill-danger'
  if (['PAUSED', 'PENDING_REVIEW', 'IN_PROCESS'].includes(value)) return 'status-pill-soon'
  return 'status-pill-muted'
}
