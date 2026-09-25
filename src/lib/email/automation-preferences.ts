import type { Json } from '@/types/database.types'

export function setAutomaticEmailDrafts(metadata: Json, enabled: boolean): Json {
  const current = getJsonRecord(metadata)

  return {
    ...current,
    auto_process_after_sync: enabled,
    auto_classify_after_sync: enabled,
    auto_draft_after_sync: enabled,
  }
}

function getJsonRecord(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}
