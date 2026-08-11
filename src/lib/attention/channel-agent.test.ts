import { describe, expect, it } from 'vitest'
import {
  ATTENTION_CHANNELS,
  CHANNEL_AGENT_CONTRACTS,
  createAttentionEvent,
  getAttentionUsageDimensions,
  normalizeChannelAgentPolicy,
} from './channel-agent'

describe('channel agent contracts', () => {
  it('defines an isolated contract for every Attention channel', () => {
    expect(Object.keys(CHANNEL_AGENT_CONTRACTS)).toEqual(ATTENTION_CHANNELS)

    for (const channel of ATTENTION_CHANNELS) {
      const contract = CHANNEL_AGENT_CONTRACTS[channel]

      expect(contract.agentKey).toBe(`${channel}_agent`)
      expect(contract.knowledge).toEqual({
        scope: 'venue',
        conversationIsKnowledge: false,
        requiresEvidenceForFacts: true,
      })
      expect(contract.boundaries).toEqual({
        conversationScope: 'venue_channel_conversation',
        identityScope: 'venue_channel',
        allowCrossChannelContext: false,
        allowCrossChannelIdentityMatching: false,
      })
      expect(contract.contentRetentionDays).toBe(90)
    }
  })

  it('keeps Email supervised and excludes direct-send actions', () => {
    expect(CHANNEL_AGENT_CONTRACTS.email.deliveryMode).toBe('supervised_draft')
    expect(CHANNEL_AGENT_CONTRACTS.email.fallbackModes).toEqual(['human_review'])
    expect(CHANNEL_AGENT_CONTRACTS.email.permittedActions).toEqual([
      'answer_from_knowledge',
      'create_supervised_draft',
      'human_handoff',
    ])
  })

  it('filters policy actions through the selected channel contract', () => {
    expect(normalizeChannelAgentPolicy('email', {
      enabled: true,
      tone: ' Formal ',
      channelPrompt: ' Only prepare a draft. ',
      fallbackMode: 'configured_contact',
      permittedActions: ['create_supervised_draft', 'verified_purchase_referral', 'human_handoff'],
    })).toEqual({
      version: 1,
      channel: 'email',
      enabled: true,
      tone: 'Formal',
      channelPrompt: 'Only prepare a draft.',
      fallbackMode: 'human_review',
      permittedActions: ['create_supervised_draft', 'human_handoff'],
    })
  })

  it('creates bounded events without visitor content or cross-channel identity', () => {
    expect(createAttentionEvent({
      tenantId: ' venue-1 ',
      channel: 'whatsapp',
      interactionId: ' message-1 ',
      eventType: 'fallback_triggered',
      occurredAt: new Date('2026-08-11T10:00:00.000Z'),
      reasonCode: ' Low confidence! ',
      sourceIds: ['source-1', 'source-1', ' ', 'source-2'],
    })).toEqual({
      version: 1,
      tenantId: 'venue-1',
      channel: 'whatsapp',
      agentKey: 'whatsapp_agent',
      interactionId: 'message-1',
      eventType: 'fallback_triggered',
      occurredAt: '2026-08-11T10:00:00.000Z',
      reasonCode: 'low_confidence',
      sourceIds: ['source-1', 'source-2'],
    })
  })

  it('maps product channels onto the existing usage dimensions', () => {
    expect(getAttentionUsageDimensions('web')).toEqual({ moduleKey: 'chatbot', usageChannel: 'chatbot' })
    expect(getAttentionUsageDimensions('instagram')).toEqual({ moduleKey: 'instagram', usageChannel: 'instagram' })
  })
})
