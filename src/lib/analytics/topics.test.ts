// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { classifyConversationTopic } from './topics'

describe('classifyConversationTopic', () => {
  it('keeps a concrete topic returned by the workflow', () => {
    expect(classifyConversationTopic('agenda', 'Cuanto cuestan las entradas?')).toBe('agenda')
  })

  it('uses deterministic inference when the workflow returns otro', () => {
    expect(classifyConversationTopic('otro', 'On és el teatre?')).toBe('ubicacion')
    expect(classifyConversationTopic('otro', 'El teatro es accesible para silla de ruedas?')).toBe('accesibilidad')
    expect(classifyConversationTopic('otro', 'Quiero comprar entradas')).toBe('entradas')
    expect(classifyConversationTopic('otro', 'Quins espectacles hi ha aquesta setmana?')).toBe('agenda')
  })

  it('normalizes accented workflow topics', () => {
    expect(classifyConversationTopic('ubicación', undefined)).toBe('ubicacion')
  })

  it('falls back to otro when no topic can be inferred', () => {
    expect(classifyConversationTopic('otro', 'Gracias')).toBe('otro')
  })
})
