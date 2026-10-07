import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketingTrendChart } from './marketing-trend-chart'

const labels = {
  title: 'Evolución diaria',
  description: 'Selecciona una métrica.',
  date: 'Fecha',
  spend: 'Inversión',
  linkClicks: 'Clics',
  ctr: 'CTR',
  accessibleTable: 'Datos diarios.',
  emptyTitle: 'Todavía no hay actividad que representar',
  emptyDescription: 'El gráfico aparecerá cuando Meta devuelva actividad diaria.',
}

describe('MarketingTrendChart', () => {
  it('keeps the chart section visible when Meta returns no daily activity', () => {
    const html = renderToStaticMarkup(
      <MarketingTrendChart currency="EUR" data={[]} labels={labels} locale="es-ES" />,
    )

    expect(html).toContain('Evolución diaria')
    expect(html).toContain('Todavía no hay actividad que representar')
    expect(html).toContain('El gráfico aparecerá cuando Meta devuelva actividad diaria.')
    expect(html).toContain('data-state="empty"')
  })
})
