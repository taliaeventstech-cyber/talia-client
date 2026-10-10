import { getMarketingCopy } from '@/lib/i18n/marketing-copy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketingAdSetCreateForm } from './marketing-ad-set-create-form'

describe('MarketingAdSetCreateForm', () => {
  it('renders the bounded traffic configuration without delivery controls', () => {
    const markup = renderToStaticMarkup(
      <MarketingAdSetCreateForm
        adsManagerUrl="https://business.facebook.com/adsmanager/manage/campaigns?act=123"
        campaigns={[{
          campaign_id: '987654321',
          name: 'Autumn traffic',
          configured_status: 'PAUSED',
          source: 'talia',
        }]}
        canCreate
        copy={getMarketingCopy('es')}
        currency="EUR"
        initialRequestId="8ced31cc-e703-42f2-aa38-e657f1c484f4"
        tenantId="657c9c3e-bf4a-45ce-868d-45a2f48db2fb"
      />,
    )

    expect(markup).toContain('Configurar un conjunto de anuncios')
    expect(markup).toContain('Autumn traffic · PAUSED')
    expect(markup).toContain('Presupuesto diario · EUR')
    expect(markup).toContain('Países de la audiencia')
    expect(markup).toContain('PAUSED')
    expect(markup).not.toContain('ACTIVE')
    expect(markup).not.toContain('billing_event')
    expect(markup).not.toContain('optimization_goal')
  })

  it('explains when no eligible traffic campaign exists', () => {
    const markup = renderToStaticMarkup(
      <MarketingAdSetCreateForm
        adsManagerUrl="https://business.facebook.com/adsmanager/manage/campaigns?act=123"
        campaigns={[]}
        canCreate
        copy={getMarketingCopy('es')}
        currency="EUR"
        initialRequestId="8ced31cc-e703-42f2-aa38-e657f1c484f4"
        tenantId="657c9c3e-bf4a-45ce-868d-45a2f48db2fb"
      />,
    )

    expect(markup).toContain('No hay campañas de tráfico disponibles.')
    expect(markup).not.toContain('name="dailyBudget"')
  })
})
