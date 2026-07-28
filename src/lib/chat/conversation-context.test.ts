import { describe, expect, it, vi } from 'vitest'

import { boundConversationContext } from './conversation-context'
import { getRecentConversationState } from './service'

describe('bounded chat conversation context', () => {
  it('keeps the newest messages in chronological order within the privacy budget', () => {
    const context = boundConversationContext([
      { role: 'assistant', content: `Última respuesta ${'x'.repeat(3_000)}` },
      { role: 'user', content: 'Entonces si mi padre está jubilado, ¿puede beneficiarse de alguno?' },
      { role: 'assistant', content: 'Respuesta anterior sobre descuentos' },
      { role: 'user', content: '¿Tenéis descuentos?' },
      { role: 'assistant', content: 'Respuesta demasiado antigua' },
      { role: 'user', content: 'Pregunta demasiado antigua' },
      { role: 'assistant', content: 'Fuera de ventana' },
    ], {
      maxMessages: 3,
      maxMessageCharacters: 2_000,
      maxTotalCharacters: 4_200,
    })

    expect(context).toHaveLength(3)
    expect(context.map((message) => message.role)).toEqual(['assistant', 'user', 'assistant'])
    expect(context[0]?.content).toBe('Respuesta anterior sobre descuentos')
    expect(context[1]?.content).toContain('mi padre está jubilado')
    expect(context[2]?.content).toHaveLength(2_000)
    expect(context.map((message) => message.content).join('').length).toBeLessThanOrEqual(4_200)
  })

  it('drops invalid or empty database rows', () => {
    expect(boundConversationContext([
      { role: 'system', content: 'No debe salir' },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'Respuesta válida' },
      { role: 'user', content: null },
    ])).toEqual([
      { role: 'assistant', content: 'Respuesta válida' },
    ])
  })

  it('loads context only from the requested tenant and session', async () => {
    const conversationQuery = createQuery({
      data: { id: 'conversation-1' },
    })
    const messagesQuery = createQuery({
      data: [
        { role: 'assistant', content: 'Respuesta anterior', metadata: { action: 'answered' } },
        { role: 'user', content: 'Pregunta anterior', metadata: {} },
      ],
    })
    const admin = {
      from: vi.fn((table: string) => table === 'conversations' ? conversationQuery : messagesQuery),
    }

    const result = await getRecentConversationState(
      admin as never,
      'tenant-safe',
      'session-safe',
    )

    expect(conversationQuery.eq).toHaveBeenCalledWith('theatre_id', 'tenant-safe')
    expect(conversationQuery.eq).toHaveBeenCalledWith('session_id', 'session-safe')
    expect(messagesQuery.eq).toHaveBeenCalledWith('theatre_id', 'tenant-safe')
    expect(messagesQuery.eq).toHaveBeenCalledWith('conversation_id', 'conversation-1')
    expect(messagesQuery.limit).toHaveBeenCalledWith(6)
    expect(result).toEqual({
      messages: [
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
      ],
      latestAssistantMetadata: { action: 'answered' },
    })
  })
})

function createQuery(result: { data: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockResolvedValue(result)
  query.maybeSingle.mockResolvedValue(result)
  return query
}
