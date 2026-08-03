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
          billing_period_start_at: '2026-08-15T15:00:00.000Z',
          billing_period_end_at: '2026-09-15T15:00:00.000Z',
          plan: 'essential',
          status: 'active',
          included_chat_conversations: 1000,
        },
        {
          id: 'previous',
          billing_period_start: '2026-07-15',
          billing_period_end: '2026-08-15',
          billing_period_start_at: '2026-07-15T15:00:00.000Z',
          billing_period_end_at: '2026-08-15T15:00:00.000Z',
          plan: 'essential',
          status: 'active',
          included_chat_conversations: 1000,
        },
      ],
      usageBySubscription: {
        current: usageTotals({ conversations: 2, messages: 8 }),
        previous: usageTotals({ conversations: 5, messages: 21 }),
      },
      billableCounts: { current: 2, previous: 1 },
      referenceDate: new Date('2026-08-20T12:00:00.000Z'),
    })

    expect(history).toMatchObject([
      {
        subscriptionId: 'current',
        periodStartAt: '2026-08-15T15:00:00.000Z',
        periodEndAt: '2026-09-15T15:00:00.000Z',
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

  it('uses exact instants when deciding which period is current', () => {
    const [history] = buildTenantUsageHistory({
      subscriptions: [{
        id: 'current',
        billing_period_start: '2026-08-15',
        billing_period_end: '2026-09-15',
        billing_period_start_at: '2026-08-15T15:00:00.000Z',
        billing_period_end_at: '2026-09-15T15:00:00.000Z',
        plan: 'essential',
        status: 'active',
        included_chat_conversations: 1000,
      }],
      usageBySubscription: {},
      billableCounts: {},
      referenceDate: new Date('2026-08-15T14:59:59.999Z'),
    })

    expect(history.isCurrent).toBe(false)
  })
})

function usageTotals(values: { conversations: number; messages: number }) {
  return {
    conversations: values.conversations,
    messages: values.messages,
    aiCalls: 0,
    toolCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    voiceMinutes: 0,
    resolutions: 0,
    fallbacks: 0,
    limitExceededEvents: 0,
    estimatedCostCents: 0,
  }
}
