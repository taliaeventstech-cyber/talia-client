export function isProgrammeExtractionEnabled(config: unknown) {
  return isRecord(config) && config.programme_extraction_enabled === true
}

export function withProgrammeExtractionEnabled(config: unknown, enabled: boolean) {
  return {
    ...(isRecord(config) ? config : {}),
    programme_extraction_enabled: enabled,
  }
}

export type ProgrammeExtractionSummary = {
  eventCount: number
  extractedDocuments: number
  errorDocuments: number
  requestCount: number
  inputTokens: number
  outputTokens: number
  lastExtractedAt: string | null
  models: string[]
}

export function summarizeProgrammeExtractionBySource(
  documents: Array<{ source_id: string; metadata: unknown }>,
) {
  const summaries = new Map<string, ProgrammeExtractionSummary>()

  for (const document of documents) {
    if (!isRecord(document.metadata) || !isRecord(document.metadata.programme_extraction)) continue
    const extraction = document.metadata.programme_extraction
    const current = summaries.get(document.source_id) ?? createEmptyProgrammeExtractionSummary()
    const usage = isRecord(extraction.usage) ? extraction.usage : {}
    const extractedAt = typeof extraction.extracted_at === 'string' ? extraction.extracted_at : null
    const model = typeof usage.model === 'string' ? usage.model : null

    current.eventCount += readNonNegativeInteger(extraction.event_count)
    current.extractedDocuments += Number(extractedAt !== null)
    current.errorDocuments += Number(extraction.status === 'error')
    current.requestCount += readNonNegativeInteger(usage.request_count)
    current.inputTokens += readNonNegativeInteger(usage.input_tokens)
    current.outputTokens += readNonNegativeInteger(usage.output_tokens)
    if (extractedAt && (!current.lastExtractedAt || extractedAt > current.lastExtractedAt)) {
      current.lastExtractedAt = extractedAt
    }
    if (model && !current.models.includes(model)) current.models.push(model)
    summaries.set(document.source_id, current)
  }

  return summaries
}

function createEmptyProgrammeExtractionSummary(): ProgrammeExtractionSummary {
  return {
    eventCount: 0,
    extractedDocuments: 0,
    errorDocuments: 0,
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    lastExtractedAt: null,
    models: [],
  }
}

function readNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
