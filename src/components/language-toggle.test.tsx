import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageToggle } from './language-toggle'

const labels = {
  label: 'Idioma',
  es: 'Español',
  ca: 'Català',
  en: 'English',
  ptBR: 'Português do Brasil',
}

describe('LanguageToggle', () => {
  it('opens below the trigger by default', () => {
    const html = renderToStaticMarkup(
      <LanguageToggle locale="es" labels={labels} />,
    )

    expect(html).toContain('language-toggle language-toggle-bottom')
  })

  it('can open above the trigger in the dashboard sidebar', () => {
    const html = renderToStaticMarkup(
      <LanguageToggle locale="es" labels={labels} menuPlacement="top" />,
    )

    expect(html).toContain('language-toggle language-toggle-top')
  })
})
