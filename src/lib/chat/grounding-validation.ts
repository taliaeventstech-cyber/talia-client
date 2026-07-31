import type { Json } from '@/types/database.types'

const MAX_TRACE_ITEMS = 8
const MAX_TRACE_VALUE_LENGTH = 300

export function summarizeGroundingValidation(value: unknown): Json | null {
  if (!isRecord(value) || (value.status !== 'accepted' && value.status !== 'rejected')) {
    return null
  }

  return {
    status: value.status,
    declared_source_ids: toBoundedStrings(value.declared_source_ids),
    invalid_source_ids: toBoundedStrings(value.invalid_source_ids),
    unsupported_critical_facts: toBoundedStrings(value.unsupported_critical_facts),
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
