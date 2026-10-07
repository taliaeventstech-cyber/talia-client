'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetaMarketingCampaignSnapshot } from '@/types/marketing'

type ComparisonMetric = 'link_clicks' | 'spend' | 'ctr'
type StatusFilter = 'all' | 'active' | 'paused' | 'other'

type Props = {
  campaigns: MetaMarketingCampaignSnapshot[]
  currency: string
  locale: string
  labels: {
    title: string
    description: string
    compareBy: string
    filterByStatus: string
    allStatuses: string
    activeCampaigns: string
    pausedCampaigns: string
    otherCampaigns: string
    noMatchingCampaigns: string
    showingTopCampaigns: string
    campaignsTitle: string
    campaign: string
    delivery: string
    spend: string
    reach: string
    linkClicks: string
    ctr: string
    cpc: string
    frequency: string
  }
}

const MAX_CHART_CAMPAIGNS = 8

export function MarketingCampaignComparison({ campaigns, currency, labels, locale }: Props) {
  const [metric, setMetric] = useState<ComparisonMetric>('link_clicks')
  const [status, setStatus] = useState<StatusFilter>('all')
  const rows = useMemo(
    () => getCampaignComparisonRows(campaigns, metric, status),
    [campaigns, metric, status],
  )
  const chartRows = rows.slice(0, MAX_CHART_CAMPAIGNS)
  const metricLabels: Record<ComparisonMetric, string> = {
    link_clicks: labels.linkClicks,
    spend: labels.spend,
    ctr: labels.ctr,
  }
  const selectedMetricLabel = metricLabels[metric]

  return (
    <section className="card stack marketing-campaign-comparison-card">
      <div className="marketing-campaign-comparison-header">
        <div>
          <h2>{labels.title}</h2>
          <p className="muted">{labels.description}</p>
        </div>
        <label className="marketing-campaign-status-filter">
          <span>{labels.filterByStatus}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">{labels.allStatuses}</option>
            <option value="active">{labels.activeCampaigns}</option>
            <option value="paused">{labels.pausedCampaigns}</option>
            <option value="other">{labels.otherCampaigns}</option>
          </select>
        </label>
      </div>

      <div className="marketing-campaign-comparison-metrics">
        <span>{labels.compareBy}</span>
        <div className="marketing-trend-controls" role="group" aria-label={labels.compareBy}>
          {(Object.keys(metricLabels) as ComparisonMetric[]).map((key) => (
            <button
              aria-pressed={metric === key}
              className="marketing-trend-control"
              key={key}
              onClick={() => setMetric(key)}
              type="button"
            >
              {metricLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="marketing-campaign-comparison-empty" role="status">
          {labels.noMatchingCampaigns}
        </div>
      ) : (
        <>
          <div
            aria-label={`${labels.title}: ${selectedMetricLabel}`}
            className="marketing-campaign-comparison-chart"
            role="img"
            style={{ height: Math.max(250, chartRows.length * 54) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 4, right: 22, bottom: 4, left: 12 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 5"
                />
                <XAxis
                  axisLine={false}
                  tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                  tickFormatter={(value: number) => (
                    formatComparisonMetric(value, metric, currency, locale, true)
                  )}
                  tickLine={false}
                  type="number"
                />
                <YAxis
                  axisLine={false}
                  dataKey="name"
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                  tickFormatter={truncateCampaignName}
                  tickLine={false}
                  type="category"
                  width={154}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '0.5px solid var(--color-border-strong)',
                    borderRadius: '8px',
                    color: 'var(--color-text-primary)',
                  }}
                  formatter={(value) => [
                    formatComparisonMetric(Number(value), metric, currency, locale),
                    selectedMetricLabel,
                  ]}
                />
                <Bar
                  dataKey={metric}
                  fill="var(--color-brand)"
                  isAnimationActive={false}
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {rows.length > MAX_CHART_CAMPAIGNS ? (
            <p className="muted marketing-campaign-comparison-limit">
              {labels.showingTopCampaigns}
            </p>
          ) : null}

          <div className="marketing-campaigns-table-heading">
            <h3>{labels.campaignsTitle}</h3>
            <span className="status-pill status-pill-muted">{rows.length}</span>
          </div>
          <div className="marketing-campaigns-table-wrap">
            <table className="data-table marketing-campaigns-table">
              <thead>
                <tr>
                  <th>{labels.campaign}</th>
                  <th>{labels.delivery}</th>
                  <th>{labels.spend}</th>
                  <th>{labels.reach}</th>
                  <th>{labels.linkClicks}</th>
                  <th>{labels.ctr}</th>
                  <th>{labels.cpc}</th>
                  <th>{labels.frequency}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((campaign) => (
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
        </>
      )}
    </section>
  )
}

export function getCampaignComparisonRows(
  campaigns: MetaMarketingCampaignSnapshot[],
  metric: ComparisonMetric,
  status: StatusFilter,
) {
  return [...campaigns]
    .filter((campaign) => matchesStatus(campaign.effective_status, status))
    .sort((left, right) => (
      right[metric] - left[metric]
      || left.name.localeCompare(right.name)
    ))
}

function matchesStatus(value: string, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'active') return value === 'ACTIVE'
  if (filter === 'paused') return isPausedStatus(value)
  return value !== 'ACTIVE' && !isPausedStatus(value)
}

function formatComparisonMetric(
  value: number,
  metric: ComparisonMetric,
  currency: string,
  locale: string,
  compact = false,
) {
  if (metric === 'spend') return formatCurrency(value, currency, locale, compact)
  if (metric === 'ctr') return formatPercentage(value, locale)
  return new Intl.NumberFormat(locale, {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

function formatCurrency(value: number, currency: string, locale: string, compact = false) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
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

function formatCampaignStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ')
}

function getCampaignStatusClass(value: string) {
  if (value === 'ACTIVE') return 'status-pill-active'
  if (['DISAPPROVED', 'WITH_ISSUES'].includes(value)) return 'status-pill-danger'
  if (isPausedStatus(value) || ['PENDING_REVIEW', 'IN_PROCESS'].includes(value)) {
    return 'status-pill-soon'
  }
  return 'status-pill-muted'
}

function isPausedStatus(value: string) {
  return ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(value)
}

function truncateCampaignName(value: string) {
  return value.length > 24 ? `${value.slice(0, 23)}…` : value
}
