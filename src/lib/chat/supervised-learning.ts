import type { Json } from '@/types/database.types'

export type ResponseRating = 'positive' | 'negative'

export type ConversationResponseReview = {
  rating: ResponseRating | null
  fallback: boolean
  eligibleForCorrection: boolean
  reason: 'negative_feedback' | 'fallback' | null
  knowledgeItemId: string | null
  publicationStatus: 'indexed' | 'pending_index' | null
  humanReviewStatus: 'accepted_valid' | null
  humanReviewedAt: string | null
  humanReviewerUserId: string | null
}

export type ConversationReviewSummary = {
  pendingNegativeCount: number
  pendingFallbackCount: number
  correctedCount: number
  acceptedCount: number
  firstPendingNegativeMessageId: string | null
  firstPendingFallbackMessageId: string | null
  firstCorrectedMessageId: string | null
  firstAcceptedMessageId: string | null
}

export function getConversationResponseReview(metadata: unknown): ConversationResponseReview {
  const root = isRecord(metadata) ? metadata : {}
  const feedback = isRecord(root.feedback) ? root.feedback : {}
  const agentMetadata = isRecord(root.agent_metadata) ? root.agent_metadata : {}
  const fallbackMetadata = isRecord(agentMetadata.fallback) ? agentMetadata.fallback : null
  const supervision = isRecord(root.supervised_learning) ? root.supervised_learning : {}
  const humanReview = isRecord(root.response_review) ? root.response_review : {}
  const rating = feedback.rating === 'positive' || feedback.rating === 'negative'
    ? feedback.rating
    : null
  const fallback = agentMetadata.action === 'fallback'
    || fallbackMetadata !== null
    || (typeof root.fallback_reason === 'string' && root.fallback_reason.length > 0)
  const reason = rating === 'negative'
    ? 'negative_feedback'
    : fallback
      ? 'fallback'
      : null
  const publicationStatus = supervision.status === 'indexed' || supervision.status === 'pending_index'
    ? supervision.status
    : null
  const humanReviewStatus = humanReview.status === 'accepted_valid'
    ? humanReview.status
    : null

  return {
    rating,
    fallback,
    eligibleForCorrection: reason !== null,
    reason,
    knowledgeItemId: typeof supervision.knowledge_item_id === 'string'
      ? supervision.knowledge_item_id
      : null,
    publicationStatus,
    humanReviewStatus,
    humanReviewedAt: typeof humanReview.reviewed_at === 'string'
      ? humanReview.reviewed_at
      : null,
    humanReviewerUserId: typeof humanReview.reviewer_user_id === 'string'
      ? humanReview.reviewer_user_id
      : null,
  }
}

export function getConversationQuestion(metadata: unknown) {
  if (!isRecord(metadata)) return null
  return typeof metadata.user_message === 'string' && metadata.user_message.trim()
    ? metadata.user_message.trim()
    : null
}

export function mergeAcceptedResponseReviewMetadata(
  metadata: Json,
  input: {
    reviewerUserId: string
    reviewedAt: string
  },
): Json {
  const root = isRecord(metadata) ? metadata : {}
  const existingReview = isRecord(root.response_review) ? root.response_review : {}
  return {
    ...root,
    response_review: {
      ...existingReview,
      status: 'accepted_valid',
      reviewed_at: input.reviewedAt,
      reviewer_user_id: input.reviewerUserId,
    },
  } as Json
}

export function getConversationReviewSummary(
  messages: Array<{ id: string; metadata: unknown }>,
  publishedMessageIds: ReadonlySet<string> = new Set(),
): ConversationReviewSummary {
  const summary: ConversationReviewSummary = {
    pendingNegativeCount: 0,
    pendingFallbackCount: 0,
    correctedCount: 0,
    acceptedCount: 0,
    firstPendingNegativeMessageId: null,
    firstPendingFallbackMessageId: null,
    firstCorrectedMessageId: null,
    firstAcceptedMessageId: null,
  }

  for (const message of messages) {
    const review = getConversationResponseReview(message.metadata)
    if (!review.eligibleForCorrection) continue

    if (review.humanReviewStatus === 'accepted_valid') {
      summary.acceptedCount += 1
      summary.firstAcceptedMessageId ??= message.id
      continue
    }

    const corrected = review.knowledgeItemId !== null || publishedMessageIds.has(message.id)
    if (corrected) {
      summary.correctedCount += 1
      summary.firstCorrectedMessageId ??= message.id
      continue
    }

    if (review.reason === 'negative_feedback') {
      summary.pendingNegativeCount += 1
      summary.firstPendingNegativeMessageId ??= message.id
    } else if (review.reason === 'fallback') {
      summary.pendingFallbackCount += 1
      summary.firstPendingFallbackMessageId ??= message.id
    }
  }

  return summary
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
