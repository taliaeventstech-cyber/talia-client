export type SupportedChatLanguage = 'ca' | 'es' | 'en' | 'pt-BR'

const LANGUAGE_MARKERS: Record<SupportedChatLanguage, string[]> = {
  ca: [
    'aquest',
    'aquesta',
    'aixo',
    'això',
    'amb',
    'compro',
    'entrades',
    'estic',
    'gos',
    'gracies',
    'gràcies',
    'meu',
    'on',
    'per',
    'perque',
    'perquè',
    'pigall',
    'poden',
    'portar',
    'puc',
    'quina',
    'quin',
    'teniu',
    'vull',
    'és',
  ],
  es: [
    'acceso',
    'comprar',
    'cuanto',
    'cuánto',
    'cual',
    'cuál',
    'cuales',
    'cuáles',
    'donde',
    'dónde',
    'entradas',
    'funcion',
    'función',
    'hay',
    'mascota',
    'perro',
    'programacion',
    'programación',
    'puedo',
    'quiero',
    'silla',
    'tengo',
    'teneis',
    'tenéis',
    'vuestra',
    'vuestro',
  ],
  en: [
    'access',
    'book',
    'buy',
    'can',
    'dog',
    'have',
    'how',
    'is',
    'parking',
    'pet',
    'tickets',
    'what',
    'when',
    'where',
    'wheelchair',
  ],
  'pt-BR': [
    'acessibilidade',
    'ajuda',
    'cadeira',
    'horarios',
    'ingressos',
    'onde',
    'posso',
    'programacao',
    'quais',
    'quando',
    'voce',
    'voces',
  ],
}

export function detectChatLanguage(message: string, fallback: string | null | undefined): SupportedChatLanguage {
  const normalized = normalizeLanguageInput(message)
  const tokens = new Set(normalized.split(' ').filter((token) => token.length > 1))
  const scores = Object.entries(LANGUAGE_MARKERS).map(([language, markers]) => ({
    language: language as SupportedChatLanguage,
    score: markers.reduce((total, marker) => total + (tokens.has(normalizeLanguageInput(marker)) ? 1 : 0), 0),
  }))
  const best = scores.sort((a, b) => b.score - a.score)[0]
  if (best && best.score > 0) return best.language

  return normalizeSupportedLanguage(fallback) ?? 'es'
}

function normalizeSupportedLanguage(language: string | null | undefined): SupportedChatLanguage | null {
  if (!language) return null
  const normalized = language.trim().toLowerCase().replace('_', '-')
  if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR'
  if (normalized === 'ca' || normalized.startsWith('ca-')) return 'ca'
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  return null
}

function normalizeLanguageInput(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
