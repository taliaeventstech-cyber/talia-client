import { describe, expect, it } from 'vitest'
import { getCommercialCurrency, getDefaultInterfaceLocaleForMarket, isCommercialMarketCountry } from './market'

describe('commercial market', () => {
  it.each([
    ['ES', 'EUR'],
    ['MX', 'MXN'],
    ['BR', 'BRL'],
  ] as const)('maps %s to %s', (country, currency) => {
    expect(getCommercialCurrency(country)).toBe(currency)
  })

  it('only accepts launch countries', () => {
    expect(isCommercialMarketCountry('MX')).toBe(true)
    expect(isCommercialMarketCountry('US')).toBe(false)
    expect(isCommercialMarketCountry(null)).toBe(false)
  })

  it('opens Brazilian onboarding accounts in Portuguese while Spanish-speaking markets use Spanish', () => {
    expect(getDefaultInterfaceLocaleForMarket('BR')).toBe('pt-BR')
    expect(getDefaultInterfaceLocaleForMarket('MX')).toBe('es')
    expect(getDefaultInterfaceLocaleForMarket('ES')).toBe('es')
  })
})
