export type EmailAgentProviderName = 'n8n' | 'talia-ai'
export type EmailAgentProviderOverride = 'inherit' | EmailAgentProviderName

export type EmailAgentProviderSelection = {
  override: EmailAgentProviderOverride
  requestedProvider: EmailAgentProviderName
}

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
