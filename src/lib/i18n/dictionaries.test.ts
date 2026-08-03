import { describe, expect, it } from 'vitest'
import { getDictionary } from './dictionaries'
import { isLocale, LOCALES } from './config'

describe('Brazilian Portuguese locale', () => {
  it('is an active locale', () => {
    expect(LOCALES).toContain('pt-BR')
    expect(isLocale('pt-BR')).toBe(true)
  })

  it('returns Portuguese copy for the main Agora surfaces', async () => {
    const dictionary = await getDictionary('pt-BR')

    expect(dictionary.language.label).toBe('Idioma da interface')
    expect(dictionary.nav.overview).toBe('Visão geral')
    expect(dictionary.nav.knowledge).toBe('Conhecimento')
    expect(dictionary.overview.usage.title).toBe('Uso do plano')
    expect(dictionary.settings.title).toBe('Configurações')
    expect(dictionary.conversations.viewMessages).toBe('Ver mensagens')
    expect(dictionary.chatbotSetup.title('Sala Fênix')).toBe('Configure o Agente Web de Sala Fênix')
  })
})

describe('client component dictionary props', () => {
  it.each(LOCALES)('keeps the Knowledge labels serializable for %s', async (locale) => {
    const dictionary = await getDictionary(locale)

    expect(() => structuredClone(dictionary.settings.knowledge)).not.toThrow()
  })
})
