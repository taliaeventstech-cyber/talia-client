import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeRateLimit } from '@/lib/auth/security'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { runWebAgentTestTurn } from '@/lib/chat/test-chat'
import { getResponseSourcesByMessageId } from '@/lib/conversations/response-sources'
import { createClient } from '@/lib/supabase/server'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { recordUsageEvent } from '@/lib/usage/service'
import { testWebAgentMessage } from './test-web-agent-action'

vi.mock('@/lib/auth/tenant-access', () => ({ requireTenantProductAccess: vi.fn() }))
vi.mock('@/lib/auth/security', () => ({ consumeRateLimit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/tenants/service', () => ({ getTenantChatConfig: vi.fn() }))
vi.mock('@/lib/chat/test-chat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chat/test-chat')>()),
  runWebAgentTestTurn: vi.fn(),
}))
vi.mock('@/lib/conversations/response-sources', () => ({ getResponseSourcesByMessageId: vi.fn() }))
vi.mock('@/lib/usage/service', () => ({ recordUsageEvent: vi.fn() }))
vi.mock('@/lib/usage/ai-cost', () => ({ recordMeasuredAiUsage: vi.fn() }))

const component = {
  component: 'answer_agent' as const,
  provider: 'openai',
  model: 'gpt-x',
  request_count: 1,
  input_tokens: 100,
  cached_input_tokens: 0,
  output_tokens: 20,
}

describe('testWebAgentMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireTenantProductAccess).mockResolvedValue({} as Awaited<ReturnType<typeof requireTenantProductAccess>>)
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(consumeRateLimit).mockResolvedValue(null)
    vi.mocked(getTenantChatConfig).mockResolvedValue({ ok: true, config: { name: 'Teatro' } } as Awaited<ReturnType<typeof getTenantChatConfig>>)
    vi.mocked(runWebAgentTestTurn).mockResolvedValue({
      ok: true,
      reply: 'Abrimos a las 18:00.',
      sources: [{ id: 'chunk-1', source_id: 'source-1', source_type: 'website', score: 0.9 }],
      state: null,
      usageComponents: [component],
      model: 'gpt-x',
      provider: 'talia-ai',
    })
    vi.mocked(recordUsageEvent).mockResolvedValue({ ok: true, duplicate: false, eventId: 'event-1' } as Awaited<ReturnType<typeof recordUsageEvent>>)
    vi.mocked(getResponseSourcesByMessageId).mockResolvedValue(new Map([['test', { sources: [{ label: 'Web oficial', href: 'web' }], additionalCount: 0 }]]))
  })

  it('answers with readable source names and works while the public widget is off', async () => {
    const result = await testWebAgentMessage('tenant-1', { message: '¿A qué hora abrís?' })

    expect(result).toEqual({
      ok: true,
      reply: 'Abrimos a las 18:00.',
      sources: [{ label: 'Web oficial', href: 'web' }],
      additionalSources: 0,
      state: null,
    })
    expect(requireTenantProductAccess).toHaveBeenCalledWith('tenant-1', 'manage_chatbot', 'web')
    expect(getTenantChatConfig).toHaveBeenCalledWith(expect.anything(), 'tenant-1', { allowDisabled: true })
    expect(vi.mocked(consumeRateLimit).mock.calls[0][0][0].key).toBe('agora-test-chat:tenant-1:user-1')
  })

  it('records only the AI cost, never a message or conversation', async () => {
    await testWebAgentMessage('tenant-1', { message: 'Hola' })

    expect(recordUsageEvent).toHaveBeenCalledTimes(1)
    expect(recordUsageEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventType: 'ai_call',
      unit: 'call',
      metadata: expect.objectContaining({ source: 'agora_test_chat' }),
    }))
    expect(vi.mocked(recordUsageEvent).mock.calls.some(([, event]) => event.eventType === 'message' || event.eventType === 'conversation_started')).toBe(false)
    expect(recordMeasuredAiUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ usageEventId: 'event-1', components: [component] }))
  })

  it('rejects invalid input and rate-limited users before calling the agent', async () => {
    await expect(testWebAgentMessage('tenant-1', { message: '' })).resolves.toEqual({ ok: false, error: 'invalid' })

    vi.mocked(consumeRateLimit).mockResolvedValue({ unavailable: false, retryAfterSeconds: 60 } as Awaited<ReturnType<typeof consumeRateLimit>>)
    await expect(testWebAgentMessage('tenant-1', { message: 'Hola' })).resolves.toEqual({ ok: false, error: 'rate_limited' })
    expect(runWebAgentTestTurn).not.toHaveBeenCalled()
  })

  it('returns a friendly error when the agent is unavailable', async () => {
    vi.mocked(runWebAgentTestTurn).mockResolvedValue({ ok: false, error: 'talia_ai_unavailable' })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(testWebAgentMessage('tenant-1', { message: 'Hola' })).resolves.toEqual({ ok: false, error: 'unavailable' })
    expect(recordUsageEvent).not.toHaveBeenCalled()
  })
})
