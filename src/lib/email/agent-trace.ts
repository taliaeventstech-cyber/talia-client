export function getEmailAgentProviderTrace() {
  return {
    provider: 'talia-ai' as const,
    requested_provider: 'talia-ai' as const,
  }
}

export function getEmailAgentPhaseTrace(raw: unknown) {
  const record = getRecord(raw)
  const metadata = getRecord(record?.metadata)
  const usage = getRecord(metadata?.usage)

  return {
    ...getEmailAgentProviderTrace(),
    agent: pickString(metadata, 'agent'),
    model: pickString(metadata, 'model'),
    action: pickString(metadata, 'action'),
    review_required: typeof metadata?.review_required === 'boolean' ? metadata.review_required : null,
    input_tokens: pickFiniteNumber(usage, 'input_tokens'),
    output_tokens: pickFiniteNumber(usage, 'output_tokens'),
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function pickString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pickFiniteNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
