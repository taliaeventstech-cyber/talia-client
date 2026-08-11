import type { Json } from '@/types/database.types'

const MAX_REJECTIONS = 8

export function summarizeTemporalQueryTrace(value: unknown): Json | null {
  if (!isRecord(value) || !['none', 'resolved', 'ambiguous'].includes(String(value.status))) {
    return null
  }

  const result: Record<string, Json> = { status: String(value.status) }
  copyInteger(result, 'target_month', value.target_month, 1, 12)
  copyInteger(result, 'target_year', value.target_year, 1900, 2200)
  copyString(result, 'source', value.source, 80)
  copyString(result, 'reference_date', value.reference_date, 10)

  if (Array.isArray(value.candidate_years)) {
    result.candidate_years = value.candidate_years
      .filter((year): year is number => Number.isInteger(year) && year >= 1900 && year <= 2200)
      .slice(0, 2)
  }

  const rejected = Array.isArray(value.rejected)
    ? value.rejected
      .filter(isRecord)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id.slice(0, 200) : '',
        reason: typeof item.reason === 'string' ? item.reason.slice(0, 80) : '',
        years: Array.isArray(item.years)
          ? item.years.filter((year): year is number => Number.isInteger(year)).slice(0, 8)
          : [],
      }))
      .filter((item) => item.id && item.reason)
      .slice(0, MAX_REJECTIONS)
    : []
  result.rejected_count = rejected.length
  result.rejected = rejected

  return result
}

function copyInteger(
  target: Record<string, Json>,
  key: string,
  value: unknown,
  minimum: number,
  maximum: number
) {
  if (Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum) {
    target[key] = Number(value)
  }
}

function copyString(target: Record<string, Json>, key: string, value: unknown, maxLength: number) {
  if (typeof value === 'string' && value.trim()) target[key] = value.trim().slice(0, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
