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

  it('does not classify questions that start with a greeting as saludo', () => {
    expect(classifyConversationTopic('otro', 'Hola, donde está el teatro?')).toBe('ubicacion')
    expect(classifyConversationTopic('otro', 'Hola, quiero comprar entradas')).toBe('entradas')
    expect(classifyConversationTopic('otro', 'Hola')).toBe('otro')
    expect(classifyConversationTopic('otro', 'Hola! Quins espectacles teniu?')).toBe('agenda')
  })

  it('does not persist workflow saludo as an analytics topic', () => {
    expect(classifyConversationTopic('saludo', 'Hola! Es pot anar en cadira de rodes?')).toBe('accesibilidad')
    expect(classifyConversationTopic('saludo', 'Hola, quins espectacles hi ha?')).toBe('agenda')
    expect(classifyConversationTopic('saludo', 'Bona tarda')).toBe('otro')
  })

  it('normalizes accented workflow topics', () => {
    expect(classifyConversationTopic('ubicación', undefined)).toBe('ubicacion')
  })

  it('falls back to otro when no topic can be inferred', () => {
    expect(classifyConversationTopic('otro', 'Gracias')).toBe('otro')
  })
})
