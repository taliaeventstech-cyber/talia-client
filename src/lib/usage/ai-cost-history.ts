export type AiCostHistoryInput = {
  date: string | null
  response_count: number | null
  request_count: number | null
  input_tokens: number | null
  cached_input_tokens: number | null
  output_tokens: number | null
  cost_usd_micros: number | null
}

export type AiCostHistoryEntry = {
  month: string
  periodStart: string
  responses: number
  requests: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  costUsdMicros: number
  isCurrent: boolean
}

export function getAiCostHistoryStartDate(referenceDate = new Date(), monthCount = 12) {
  const boundedMonthCount = Math.max(1, Math.trunc(monthCount))
  return new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth() - boundedMonthCount + 1,
    1,
  )).toISOString().slice(0, 10)
}

export function buildAiCostMonthlyHistory(
  rows: AiCostHistoryInput[],
  referenceDate = new Date(),
  monthCount = 12,
): AiCostHistoryEntry[] {
  const currentMonth = toMonthKey(referenceDate)
  const earliestAllowedMonth = getAiCostHistoryStartDate(referenceDate, monthCount).slice(0, 7)
  const grouped = new Map<string, AiCostHistoryEntry>()

  rows.forEach((row) => {
    const month = row.date?.slice(0, 7)
    if (!month || month < earliestAllowedMonth || month > currentMonth) return

    const current = grouped.get(month) ?? emptyMonth(month, currentMonth)
    current.responses += row.response_count ?? 0
    current.requests += row.request_count ?? 0
    current.inputTokens += row.input_tokens ?? 0
    current.cachedInputTokens += row.cached_input_tokens ?? 0
    current.outputTokens += row.output_tokens ?? 0
    current.costUsdMicros += Number(row.cost_usd_micros ?? 0)
    grouped.set(month, current)
  })

  if (!grouped.has(currentMonth)) grouped.set(currentMonth, emptyMonth(currentMonth, currentMonth))

  const earliestRecordedMonth = Array.from(grouped.keys()).sort()[0] ?? currentMonth
  const entries: AiCostHistoryEntry[] = []
  let cursor = parseMonth(earliestRecordedMonth)
  const end = parseMonth(currentMonth)

  while (cursor <= end) {
    const month = toMonthKey(cursor)
    entries.push(grouped.get(month) ?? emptyMonth(month, currentMonth))
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }

  return entries.reverse()
}

function emptyMonth(month: string, currentMonth: string): AiCostHistoryEntry {
  return {
    month,
    periodStart: `${month}-01`,
    responses: 0,
    requests: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costUsdMicros: 0,
    isCurrent: month === currentMonth,
  }
}

function parseMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1, 1))
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
