import { describe, expect, it } from 'vitest'
import { buildTenantUsageHistory } from './service'

describe('buildTenantUsageHistory', () => {
  it('groups daily totals and billable replies by subscription period', () => {
    const history = buildTenantUsageHistory({
      subscriptions: [
        {
          id: 'current',
          billing_period_start: '2026-08-15',
          billing_period_end: '2026-09-15',
          plan: 'essential',
          status: 'active',
          included_chat_conversations: 1000,
        },
        {
          id: 'previous',
          billing_period_start: '2026-07-15',
          billing_period_end: '2026-08-15',
          plan: 'essential',
          status: 'active',
          included_chat_conversations: 1000,
        },
      ],
      usageRows: [
        usageRow('2026-08-20', { conversations: 2, messages: 8 }),
        usageRow('2026-08-14', { conversations: 5, messages: 21 }),
      ],
      billableCounts: { current: 2, previous: 1 },
      referenceDate: new Date('2026-08-20T12:00:00.000Z'),
    })

    expect(history).toMatchObject([
      {
        subscriptionId: 'current',
        billableChatMessages: 2,
        visitorChatMessages: 6,
        totalChatMessages: 8,
        unansweredChatMessages: 4,
        usage: { conversations: 2, messages: 8 },
        isCurrent: true,
      },
      {
        subscriptionId: 'previous',
        billableChatMessages: 1,
        visitorChatMessages: 20,
        totalChatMessages: 21,
        unansweredChatMessages: 19,
        usage: { conversations: 5, messages: 21 },
        isCurrent: false,
      },
    ])
  })
})

function usageRow(date: string, values: { conversations: number; messages: number }) {
  return {
    date,
    conversations: values.conversations,
    messages: values.messages,
    ai_calls: 0,
    tool_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    voice_minutes: 0,
    resolutions: 0,
    fallbacks: 0,
    limit_exceeded_events: 0,
    estimated_cost_cents: 0,
  }
}
