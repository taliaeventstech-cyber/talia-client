import type { MarketingCopy } from '@/lib/i18n/marketing-copy'
import type { MetaMarketingPeriod } from '@/types/marketing'

const periods: MetaMarketingPeriod[] = ['last_7d', 'last_30d', 'last_90d']

export function MarketingPeriodSelector({ copy, period, tenantId }: {
  copy: MarketingCopy
  period: MetaMarketingPeriod
  tenantId: string
}) {
  return (
    <nav className="marketing-period-selector" aria-label={copy.periodLabel}>
      {periods.map((option) => (
        <a
          aria-current={option === period ? 'page' : undefined}
          className={option === period ? 'is-active' : undefined}
          href={`/${tenantId}/marketing?marketing_period=${option}`}
          key={option}
        >
          {getMarketingPeriodLabel(copy, option)}
        </a>
      ))}
    </nav>
  )
}

export function getMarketingPeriodLabel(
  copy: MarketingCopy,
  period: MetaMarketingPeriod,
) {
  if (period === 'last_7d') return copy.last7Days
  if (period === 'last_90d') return copy.last90Days
  return copy.last30Days
}
