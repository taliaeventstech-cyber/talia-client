import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getMarketingCopy } from '@/lib/i18n/marketing-copy'
import { MarketingPeriodSelector } from './marketing-period-selector'

describe('MarketingPeriodSelector', () => {
  it('links every supported period and exposes the selected one', () => {
    const markup = renderToStaticMarkup(
      <MarketingPeriodSelector
        copy={getMarketingCopy('es')}
        period="last_90d"
        tenantId="venue-1"
      />,
    )

    expect(markup).toContain('marketing_period=last_7d')
    expect(markup).toContain('marketing_period=last_30d')
    expect(markup).toContain('marketing_period=last_90d')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('Últimos 90 días')
  })
})
