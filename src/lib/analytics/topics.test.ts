// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { classifyConversationTopic, parseChatAnalytics, saveConversationTopic } from './topics'

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

  it('accepts the typed analytics contract returned by talia-ai', () => {
    expect(parseChatAnalytics({
      topic: 'visita',
      intent: 'planning',
      confidence: 0.91,
      taxonomy_version: 'chat-v1',
      source: 'answer_agent',
    })).toEqual({
      topic: 'visita',
      intent: 'planning',
      confidence: 0.91,
      taxonomyVersion: 'chat-v1',
      source: 'answer_agent',
    })
  })

  it('rejects incomplete or unknown analytics classifications', () => {
    expect(parseChatAnalytics({
      topic: 'inventado',
      intent: 'planning',
      confidence: 0.91,
      taxonomy_version: 'chat-v1',
      source: 'answer_agent',
    })).toBeNull()
    expect(parseChatAnalytics({
      topic: 'visita',
      intent: 'planning',
      confidence: 2,
      taxonomy_version: 'chat-v1',
      source: 'answer_agent',
    })).toBeNull()
  })

  it('persists a message-linked analytics event idempotently', async () => {
    const writes: Array<{ record: unknown; options: unknown }> = []
    const admin = {
      from: (table: string) => {
        expect(table).toBe('conversation_topics')
        return {
          upsert: (record: unknown, options: unknown) => {
            writes.push({ record, options })
            return Promise.resolve({ error: null })
          },
        }
      },
    }

    const result = await saveConversationTopic(admin as never, {
      tenantId: '00000000-0000-4000-8000-000000000001',
      sessionId: 'session-1',
      messageId: '00000000-0000-4000-8000-000000000002',
      topic: 'visita',
      intent: 'planning',
      confidence: 0.91,
      taxonomyVersion: 'chat-v1',
      classificationSource: 'answer_agent',
      userMessage: '¿Podemos organizar una visita escolar?',
      channel: 'web',
    })

    expect(result).toEqual({ ok: true })
    expect(writes).toEqual([{
      record: {
        theatre_id: '00000000-0000-4000-8000-000000000001',
        session_id: 'session-1',
        message_id: '00000000-0000-4000-8000-000000000002',
        topic: 'visita',
        intent: 'planning',
        confidence: 0.91,
        taxonomy_version: 'chat-v1',
        classification_source: 'answer_agent',
        user_message: '¿Podemos organizar una visita escolar?',
        channel: 'web',
      },
      options: { onConflict: 'message_id' },
    }])
  })
})
