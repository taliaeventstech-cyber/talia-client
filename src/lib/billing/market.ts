export const COMMERCIAL_MARKET_COUNTRIES = ['ES', 'MX', 'BR'] as const

export type CommercialMarketCountry = (typeof COMMERCIAL_MARKET_COUNTRIES)[number]
export type CommercialCurrency = 'EUR' | 'MXN' | 'BRL'

const currencyByCountry: Record<CommercialMarketCountry, CommercialCurrency> = {
  ES: 'EUR',
  MX: 'MXN',
  BR: 'BRL',
}

export function isCommercialMarketCountry(value: unknown): value is CommercialMarketCountry {
  return typeof value === 'string' && COMMERCIAL_MARKET_COUNTRIES.includes(value as CommercialMarketCountry)
}

export function getCommercialCurrency(country: CommercialMarketCountry): CommercialCurrency {
  return currencyByCountry[country]
}

export function normalizeCommercialMarketCountry(value: unknown): CommercialMarketCountry {
  return isCommercialMarketCountry(value) ? value : 'ES'
}

export function getDefaultInterfaceLocaleForMarket(country: CommercialMarketCountry): 'es' | 'pt-BR' {
  return country === 'BR' ? 'pt-BR' : 'es'
}
