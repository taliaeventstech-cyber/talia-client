import { describe, expect, it, vi } from 'vitest'
import type { ChatAgentRuntimeInput } from '@/lib/agent-runtime/chat'
import type { TenantChatConfig } from '@/lib/tenants/service'
import { buildTestChatState, runWebAgentTestTurn, testChatRequestSchema } from './test-chat'

const config = {
  tenantId: 'tenant-1',
  name: 'Teatro Demo',
  language: 'es',
  responseTone: 'close',
  systemPrompt: 'Sé breve.',
  fallbackEmail: 'info@teatro.es',
  fallbackPhone: null,
  websiteUrl: 'https://teatro.es',
  aiSettings: { fallbackContacts: true },
  suggestedQuestions: [],
} as unknown as TenantChatConfig

describe('Agora test chat', () => {
  it('runs the same agent with bounded history, follow-up state and the venue configuration', async () => {
    const runAgent = vi.fn(async (_input: ChatAgentRuntimeInput) => ({
      ok: true as const,
      provider: 'talia-ai' as const,
      reply: 'Abrimos a las 18:00. Escribe a otro@spam.com o info@teatro.es.',
      model: 'gpt-x',
      sources: [{ id: 'chunk-1', source_id: 'source-1', source_type: 'website', score: 0.9 }],
      metadata: {
        action: 'clarification_requested',
        clarification: { intent: 'schedule', options: ['Hoy', 'Mañana'] },
        resolution: { version: 1, state: 'clarification', clarification_attempts: 1, topic: null, intent: null },
        analytics: { topic: 'horarios' },
      },
      usageComponents: [],
    }))

    const request = testChatRequestSchema.parse({
      message: '¿Y mañana?',
      history: [
        { role: 'user', content: '¿A qué hora abrís?' },
        { role: 'assistant', content: '¿Para qué día?' },
      ],
      state: { action: 'clarification_requested', clarification: { intent: 'schedule', options: ['Hoy', 'Mañana'] } },
      pageUrl: 'https://teatro.es/agenda',
    })

    const turn = await runWebAgentTestTurn({ tenantId: 'tenant-1', sessionId: 'agora-test:user-1', config, request }, runAgent)

    const input = runAgent.mock.calls[0][0]
    expect(input.conversationContext).toEqual([
      { role: 'user', content: '¿A qué hora abrís?' },
      { role: 'assistant', content: '¿Para qué día?' },
    ])
    expect(input.pendingClarification).toMatchObject({ intent: 'schedule', options: ['Hoy', 'Mañana'] })
    expect(input.tenant).toMatchObject({ name: 'Teatro Demo', systemPrompt: 'Sé breve.', fallbackEmail: 'info@teatro.es' })
    expect(input.pageUrl).toBe('https://teatro.es/agenda')

    expect(turn).toMatchObject({ ok: true, provider: 'talia-ai' })
    if (!turn.ok) return
    // Same contact guard as the public widget.
    expect(turn.reply).toBe('Abrimos a las 18:00. Escribe a info@teatro.es o info@teatro.es.')
    expect(turn.sources).toEqual([{ id: 'chunk-1', source_id: 'source-1', source_type: 'website', score: 0.9 }])
    // Only what the next turn needs is handed back to the browser.
    expect(turn.state).toEqual({
      action: 'clarification_requested',
      clarification: { intent: 'schedule', options: ['Hoy', 'Mañana'] },
      resolution: { version: 1, state: 'clarification', clarification_attempts: 1, topic: null, intent: null },
    })
  })

  it('reports agent failures without throwing', async () => {
    const runAgent = vi.fn(async () => ({ ok: false as const, provider: 'talia-ai' as const, error: 'talia_ai_unavailable', status: 503 }))
    const turn = await runWebAgentTestTurn({
      tenantId: 'tenant-1',
      sessionId: 's',
      config,
      request: testChatRequestSchema.parse({ message: 'Hola' }),
    }, runAgent as never)

    expect(turn).toEqual({ ok: false, error: 'talia_ai_unavailable' })
  })

  it('ignores oversized or empty state and validates input', () => {
    expect(buildTestChatState(undefined)).toBeNull()
    expect(buildTestChatState({ analytics: { topic: 'x' } })).toBeNull()
    expect(buildTestChatState({ resolution: { note: 'x'.repeat(5_000) } })).toBeNull()
    expect(testChatRequestSchema.safeParse({ message: '   ' }).success).toBe(false)
    expect(testChatRequestSchema.safeParse({ message: 'a'.repeat(2_001) }).success).toBe(false)
  })
})
