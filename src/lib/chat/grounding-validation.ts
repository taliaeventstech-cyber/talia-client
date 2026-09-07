import type { Json } from '@/types/database.types'

const MAX_TRACE_ITEMS = 8
const MAX_TRACE_VALUE_LENGTH = 300

export function summarizeGroundingValidation(value: unknown): Json | null {
  if (!isRecord(value) || (value.status !== 'accepted' && value.status !== 'rejected')) {
    return null
  }

  const result: Record<string, Json> = {
    status: value.status,
    declared_source_ids: toBoundedStrings(value.declared_source_ids),
    invalid_source_ids: toBoundedStrings(value.invalid_source_ids),
    lexical_mismatches: toBoundedStrings(value.lexical_mismatches),
    semantic_review_facts: toBoundedStrings(value.semantic_review_facts),
    unsupported_critical_facts: toBoundedStrings(value.unsupported_critical_facts),
  }
  const review = summarizeReview(value.review)
  if (review) result.review = review

  return result
}

function summarizeReview(value: unknown): Json | null {
  if (!isRecord(value)) return null
  if (typeof value.status !== 'string' || !GROUNDING_REVIEW_STATUSES.has(value.status)) return null
  if (typeof value.reason !== 'string' || !value.reason.trim()) return null
  if (!Number.isInteger(value.reviewed_count) || Number(value.reviewed_count) < 0) return null

  return {
    status: value.status as string,
    reason: value.reason.trim().slice(0, 120),
    reviewed_count: Math.min(Number(value.reviewed_count), MAX_TRACE_ITEMS),
  }
}

function toBoundedStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, MAX_TRACE_VALUE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TRACE_ITEMS)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const GROUNDING_REVIEW_STATUSES = new Set([
  'not_required',
  'accepted',
  'rejected',
  'unavailable',
  'trusted_agent_declaration',
])
