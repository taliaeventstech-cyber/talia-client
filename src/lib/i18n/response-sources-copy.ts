import type { Locale } from './config'

export type ResponseSourcesCopy = {
  title: string
  more: (count: number) => string
  viewKnowledge: string
}

const copy: Record<Locale, ResponseSourcesCopy> = {
  es: {
    title: 'Información utilizada por TALIA',
    more: (count) => `y ${count} fuente${count === 1 ? '' : 's'} más`,
    viewKnowledge: 'Ver en Conocimiento',
  },
  ca: {
    title: 'Informació utilitzada per TALIA',
    more: (count) => `i ${count} font${count === 1 ? '' : 's'} més`,
    viewKnowledge: 'Veure a Coneixement',
  },
  en: {
    title: 'Information used by TALIA',
    more: (count) => `and ${count} more source${count === 1 ? '' : 's'}`,
    viewKnowledge: 'View in Knowledge',
  },
  'pt-BR': {
    title: 'Informação usada pela TALIA',
    more: (count) => `e mais ${count} fonte${count === 1 ? '' : 's'}`,
    viewKnowledge: 'Ver em Conhecimento',
  },
}

export function getResponseSourcesCopy(locale: Locale) {
  return copy[locale]
}
