import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getMarketingDemoData } from '@/lib/marketing/demo-data'
import {
  getCampaignComparisonRows,
  MarketingCampaignComparison,
} from './marketing-campaign-comparison'

const labels = {
  title: 'Comparación de campañas',
  description: 'Compara el rendimiento durante los últimos 30 días.',
  compareBy: 'Comparar por',
  filterByStatus: 'Filtrar por estado',
  allStatuses: 'Todos los estados',
  activeCampaigns: 'Activas',
  pausedCampaigns: 'Pausadas',
  otherCampaigns: 'Otros estados',
  noMatchingCampaigns: 'No hay campañas con este estado.',
  showingTopCampaigns: 'Se muestran las 8 campañas con mayor resultado.',
  campaignsTitle: 'Detalle de campañas',
  campaign: 'Campaña',
  delivery: 'Entrega',
  spend: 'Inversión',
  reach: 'Alcance',
  linkClicks: 'Clics en enlace',
  ctr: 'CTR',
  cpc: 'CPC',
  frequency: 'Frecuencia',
}

const campaigns = getMarketingDemoData('1', 'development')!.snapshot.campaigns

describe('MarketingCampaignComparison', () => {
  it('ranks campaigns by the selected outcome and filters statuses deterministically', () => {
    const campaignPausedByParent = {
      ...campaigns[0]!,
      campaign_id: 'demo-parent-paused',
      name: 'Campaña pausada por el conjunto',
      effective_status: 'CAMPAIGN_PAUSED',
    }

    expect(getCampaignComparisonRows(campaigns, 'link_clicks', 'all')[0]?.name)
      .toBe('Abonos de temporada')
    expect(getCampaignComparisonRows(campaigns, 'link_clicks', 'active'))
      .toHaveLength(2)
    expect(getCampaignComparisonRows(campaigns, 'spend', 'paused').map(({ name }) => name))
      .toEqual(['Estreno de otoño'])
    expect(getCampaignComparisonRows(
      [...campaigns, campaignPausedByParent],
      'spend',
      'paused',
    ).map(({ name }) => name)).toContain('Campaña pausada por el conjunto')
  })

  it('renders the comparison controls and exact campaign table', () => {
    const html = renderToStaticMarkup(
      <MarketingCampaignComparison
        campaigns={campaigns}
        currency="EUR"
        labels={labels}
        locale="es-ES"
      />,
    )

    expect(html).toContain('Comparación de campañas')
    expect(html).toContain('Filtrar por estado')
    expect(html).toContain('Abonos de temporada')
    expect(html).toContain('Detalle de campañas')
  })
})
