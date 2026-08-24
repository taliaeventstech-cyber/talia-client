import { describe, expect, it } from 'vitest'
import { getProcessableEmailText } from './body-content'

describe('getProcessableEmailText', () => {
  it('keeps the provider plain-text body when available', () => {
    expect(getProcessableEmailText('  Consulta sobre horarios  ', '<p>Other</p>')).toBe('Consulta sobre horarios')
  })

  it('derives readable text from an HTML-only email without retaining markup', () => {
    expect(getProcessableEmailText(null, '<p>Hola &amp; gracias</p><p>Necesito ayuda<br>con horarios.</p>'))
      .toBe('Hola & gracias\nNecesito ayuda\ncon horarios.')
  })

  it('excludes executable and styling markup from the agent input', () => {
    expect(getProcessableEmailText(null, '<style>hidden</style><script>alert(1)</script><p>Consulta real</p>'))
      .toBe('Consulta real')
  })
})
