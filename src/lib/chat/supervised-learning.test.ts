import { describe, expect, it } from 'vitest'
import {
  getConversationQuestion,
  getConversationResponseReview,
  getConversationReviewSummary,
  mergeAcceptedResponseReviewMetadata,
} from './supervised-learning'

describe('supervised conversation learning', () => {
  it('exposes positive ratings without offering a correction workflow', () => {
    expect(getConversationResponseReview({
      feedback: { rating: 'positive' },
      agent_metadata: { action: 'answered' },
    })).toEqual({
      rating: 'positive',
      fallback: false,
      eligibleForCorrection: false,
      reason: null,
      knowledgeItemId: null,
      publicationStatus: null,
      humanReviewStatus: null,
      humanReviewedAt: null,
      humanReviewerUserId: null,
    })
  })

  it('allows supervised correction for a negative answer', () => {
    expect(getConversationResponseReview({
      feedback: { rating: 'negative' },
      agent_metadata: { action: 'answered' },
    })).toMatchObject({
      rating: 'negative',
      fallback: false,
      eligibleForCorrection: true,
      reason: 'negative_feedback',
    })
  })

  it('allows supervised correction for an unrated fallback', () => {
    expect(getConversationResponseReview({
      agent_metadata: {
        action: 'fallback',
        fallback: { reason: 'no_evidence' },
      },
    })).toMatchObject({
      rating: null,
      fallback: true,
      eligibleForCorrection: true,
      reason: 'fallback',
    })
  })

  it('recovers the linked FAQ and original visitor question', () => {
    const metadata = {
      user_message: '¿Se permiten perros guía?',
      supervised_learning: {
        status: 'indexed',
        knowledge_item_id: 'faq-1',
      },
    }

    expect(getConversationQuestion(metadata)).toBe('¿Se permiten perros guía?')
    expect(getConversationResponseReview(metadata)).toMatchObject({
      knowledgeItemId: 'faq-1',
      publicationStatus: 'indexed',
    })
  })

  it('summarizes pending and corrected responses without double-counting them', () => {
    const summary = getConversationReviewSummary([
      {
        id: 'negative-pending',
        metadata: {
          feedback: { rating: 'negative' },
          agent_metadata: { action: 'answered' },
        },
      },
      {
        id: 'fallback-pending',
        metadata: {
          agent_metadata: { action: 'fallback' },
        },
      },
      {
        id: 'negative-corrected',
        metadata: {
          feedback: { rating: 'negative' },
          supervised_learning: {
            knowledge_item_id: 'faq-1',
            status: 'indexed',
          },
        },
      },
      {
        id: 'positive',
        metadata: {
          feedback: { rating: 'positive' },
        },
      },
    ])

    expect(summary).toEqual({
      pendingNegativeCount: 1,
      pendingFallbackCount: 1,
      correctedCount: 1,
      acceptedCount: 0,
      firstPendingNegativeMessageId: 'negative-pending',
      firstPendingFallbackMessageId: 'fallback-pending',
      firstCorrectedMessageId: 'negative-corrected',
      firstAcceptedMessageId: null,
    })
  })

  it('recognizes a correction from its deterministic FAQ id', () => {
    expect(getConversationReviewSummary([
      {
        id: 'message-with-faq',
        metadata: { feedback: { rating: 'negative' } },
      },
    ], new Set(['message-with-faq']))).toMatchObject({
      pendingNegativeCount: 0,
      correctedCount: 1,
      firstCorrectedMessageId: 'message-with-faq',
    })
  })

  it('keeps visitor feedback while recognizing a human-approved response', () => {
    const metadata = mergeAcceptedResponseReviewMetadata({
      feedback: { rating: 'negative', submitted_at: '2026-07-30T09:00:00Z' },
      agent_metadata: { action: 'answered' },
    }, {
      reviewedAt: '2026-07-30T10:00:00Z',
      reviewerUserId: 'user-1',
    })

    expect(getConversationResponseReview(metadata)).toMatchObject({
      rating: 'negative',
      humanReviewStatus: 'accepted_valid',
      humanReviewedAt: '2026-07-30T10:00:00Z',
      humanReviewerUserId: 'user-1',
    })
    expect(metadata).toMatchObject({
      feedback: { rating: 'negative', submitted_at: '2026-07-30T09:00:00Z' },
      agent_metadata: { action: 'answered' },
    })
    expect(getConversationReviewSummary([{ id: 'accepted', metadata }])).toMatchObject({
      pendingNegativeCount: 0,
      acceptedCount: 1,
      firstAcceptedMessageId: 'accepted',
    })
  })
})
