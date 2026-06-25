// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { detectChatLanguage } from './language'

describe('detectChatLanguage', () => {
  it('detects Catalan visitor questions', () => {
    expect(detectChatLanguage('Puc portar el meu gos? No és gos pigall, és la meva mascota.', 'es')).toBe('ca')
  })

  it('detects Spanish visitor questions', () => {
    expect(detectChatLanguage('¿Puedo llevar a mi perro al teatro?', 'ca')).toBe('es')
  })

  it('detects English visitor questions', () => {
    expect(detectChatLanguage('Can I bring my dog to the theatre?', 'es')).toBe('en')
  })

  it('falls back to the tenant language when the message is ambiguous', () => {
    expect(detectChatLanguage('12345', 'ca')).toBe('ca')
  })
})
