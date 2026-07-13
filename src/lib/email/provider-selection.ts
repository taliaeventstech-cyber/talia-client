export type EmailAgentProviderName = 'n8n' | 'talia-ai'
export type EmailAgentProviderOverride = 'inherit' | EmailAgentProviderName

export type EmailAgentProviderSelection = {
  override: EmailAgentProviderOverride
  requestedProvider: EmailAgentProviderName
}

export type EmailAgentPhaseTrace = ReturnType<typeof getEmailAgentPhaseTrace>

export function resolveEmailAgentProvider(
  metadata: unknown,
  environmentProvider = process.env.EMAIL_AGENT_PROVIDER,
): EmailAgentProviderSelection {
  const override = getEmailAgentProviderOverride(metadata)
  if (override !== 'inherit') return { override, requestedProvider: override }

  return {
    override,
    requestedProvider: environmentProvider === 'talia-ai' ? 'talia-ai' : 'n8n',
  }
}

export function getEmailAgentProviderOverride(metadata: unknown): EmailAgentProviderOverride {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'inherit'
  const value = (metadata as Record<string, unknown>).email_agent_provider
  return value === 'talia-ai' || value === 'n8n' ? value : 'inherit'
}

export function getEmailAgentProviderTrace(raw: unknown, selection: EmailAgentProviderSelection) {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null
  const provider: EmailAgentProviderName = record?.provider === 'talia-ai' ? 'talia-ai' : 'n8n'

  return {
    provider,
    requested_provider: selection.requestedProvider,
    provider_override: selection.override,
    fallback_used: record?.fallback_from === selection.requestedProvider && provider !== selection.requestedProvider,
  }
}

export function getEmailAgentPhaseTrace(raw: unknown, selection: EmailAgentProviderSelection) {
  const providerTrace = getEmailAgentProviderTrace(raw, selection)
  const record = getRecord(raw)
  const metadata = getRecord(record?.metadata)
  const usage = getRecord(metadata?.usage)

  return {
    ...providerTrace,
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
