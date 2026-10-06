'use client'

import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetaMarketingDailyInsight } from '@/types/marketing'

type MetricKey = 'spend' | 'link_clicks' | 'ctr'

type Props = {
  currency: string
  data: MetaMarketingDailyInsight[]
  locale: string
  labels: {
    title: string
    description: string
    date: string
    spend: string
    linkClicks: string
    ctr: string
    accessibleTable: string
  }
}

export function MarketingTrendChart({ currency, data, labels, locale }: Props) {
  const [metric, setMetric] = useState<MetricKey>('spend')
  const metricLabels: Record<MetricKey, string> = {
    spend: labels.spend,
    link_clicks: labels.linkClicks,
    ctr: labels.ctr,
  }
  const selectedLabel = metricLabels[metric]

  return (
    <section className="card marketing-trend-card">
      <div className="marketing-trend-header">
        <div>
          <h2>{labels.title}</h2>
          <p className="muted">{labels.description}</p>
        </div>
        <div className="marketing-trend-controls" role="group" aria-label={labels.title}>
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
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

      <div
        aria-label={`${labels.title}: ${selectedLabel}`}
        className="marketing-trend-chart"
        role="img"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="marketingTrendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              minTickGap={24}
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
              tickFormatter={(value: string) => formatDate(value, locale, 'short')}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
              tickFormatter={(value: number) => formatMetric(value, metric, currency, locale, true)}
              tickLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border-strong)',
                borderRadius: '8px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => [
                formatMetric(Number(value), metric, currency, locale),
                selectedLabel,
              ]}
              labelFormatter={(value) => formatDate(String(value), locale, 'long')}
            />
            <Area
              activeDot={{ r: 5, fill: 'var(--color-brand)' }}
              dataKey={metric}
              fill="url(#marketingTrendFill)"
              isAnimationActive={false}
              stroke="var(--color-brand)"
              strokeWidth={2.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{labels.accessibleTable}</caption>
        <thead>
          <tr>
            <th>{labels.date}</th>
            <th>{labels.spend}</th>
            <th>{labels.linkClicks}</th>
            <th>{labels.ctr}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((insight) => (
            <tr key={insight.date}>
              <td>{formatDate(insight.date, locale, 'long')}</td>
              <td>{formatMetric(insight.spend, 'spend', currency, locale)}</td>
              <td>{formatMetric(insight.link_clicks, 'link_clicks', currency, locale)}</td>
              <td>{formatMetric(insight.ctr, 'ctr', currency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function formatMetric(
  value: number,
  metric: MetricKey,
  currency: string,
  locale: string,
  compact = false,
) {
  if (metric === 'spend') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value)
  }
  if (metric === 'ctr') {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`
  }
  return new Intl.NumberFormat(locale, {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

function formatDate(value: string, locale: string, style: 'short' | 'long') {
  return new Intl.DateTimeFormat(locale, style === 'short'
    ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
  ).format(new Date(`${value}T00:00:00Z`))
}
