export const ATTENTION_CHANNELS = [
  'web',
  'email',
  'voice',
  'whatsapp',
  'instagram',
] as const

export type AttentionChannel = typeof ATTENTION_CHANNELS[number]
export type ChannelAgentKey = `${AttentionChannel}_agent`

export const CHANNEL_AGENT_ACTIONS = [
  'answer_from_knowledge',
  'ask_clarifying_question',
  'create_supervised_draft',
  'verified_navigation',
  'verified_purchase_referral',
  'human_handoff',
] as const

export type ChannelAgentAction = typeof CHANNEL_AGENT_ACTIONS[number]
export type ChannelAgentFallbackMode = 'configured_contact' | 'human_review' | 'human_handoff'
export type ChannelAgentDeliveryMode = 'direct_response' | 'supervised_draft' | 'spoken_response'
export type ChannelAgentLimitUnit = 'message' | 'email' | 'minute'

export type ChannelAgentContract = Readonly<{
  version: 1
  channel: AttentionChannel
  agentKey: ChannelAgentKey
  mission: string
  deliveryMode: ChannelAgentDeliveryMode
  languagePolicy: 'inbound_message_with_venue_fallback'
  tonePolicy: 'channel_configured'
  knowledge: Readonly<{
    scope: 'venue'
    conversationIsKnowledge: false
    requiresEvidenceForFacts: true
  }>
  boundaries: Readonly<{
    conversationScope: 'venue_channel_conversation'
    identityScope: 'venue_channel'
    allowCrossChannelContext: false
    allowCrossChannelIdentityMatching: false
  }>
  fallbackModes: readonly ChannelAgentFallbackMode[]
  defaultFallbackMode: ChannelAgentFallbackMode
  permittedActions: readonly ChannelAgentAction[]
  limitUnit: ChannelAgentLimitUnit
  contentRetentionDays: 90
}>

const SHARED_KNOWLEDGE_POLICY = {
  scope: 'venue',
  conversationIsKnowledge: false,
  requiresEvidenceForFacts: true,
} as const

const CHANNEL_BOUNDARIES = {
  conversationScope: 'venue_channel_conversation',
  identityScope: 'venue_channel',
  allowCrossChannelContext: false,
  allowCrossChannelIdentityMatching: false,
} as const

export const CHANNEL_AGENT_CONTRACTS = {
  web: channelContract({
    channel: 'web',
    mission: 'Answer visitor questions on the venue website and route safe next steps.',
    deliveryMode: 'direct_response',
    fallbackModes: ['configured_contact', 'human_handoff'],
    defaultFallbackMode: 'configured_contact',
    permittedActions: [
      'answer_from_knowledge',
      'ask_clarifying_question',
      'verified_navigation',
      'verified_purchase_referral',
      'human_handoff',
    ],
    limitUnit: 'message',
  }),
  email: channelContract({
    channel: 'email',
    mission: 'Classify inbound mailbox requests and prepare drafts for human review.',
    deliveryMode: 'supervised_draft',
    fallbackModes: ['human_review'],
    defaultFallbackMode: 'human_review',
    permittedActions: [
      'answer_from_knowledge',
      'create_supervised_draft',
      'human_handoff',
    ],
    limitUnit: 'email',
  }),
  voice: channelContract({
    channel: 'voice',
    mission: 'Resolve spoken visitor questions and escalate safely when needed.',
    deliveryMode: 'spoken_response',
    fallbackModes: ['configured_contact', 'human_handoff'],
    defaultFallbackMode: 'human_handoff',
    permittedActions: [
      'answer_from_knowledge',
      'ask_clarifying_question',
      'verified_navigation',
      'human_handoff',
    ],
    limitUnit: 'minute',
  }),
  whatsapp: channelContract({
    channel: 'whatsapp',
    mission: 'Handle venue-owned WhatsApp conversations and escalate to the venue team.',
    deliveryMode: 'direct_response',
    fallbackModes: ['configured_contact', 'human_handoff'],
    defaultFallbackMode: 'human_handoff',
    permittedActions: [
      'answer_from_knowledge',
      'ask_clarifying_question',
      'verified_navigation',
      'human_handoff',
    ],
    limitUnit: 'message',
  }),
  instagram: channelContract({
    channel: 'instagram',
    mission: 'Handle eligible Instagram direct messages and escalate to the venue team.',
    deliveryMode: 'direct_response',
    fallbackModes: ['configured_contact', 'human_handoff'],
    defaultFallbackMode: 'human_handoff',
    permittedActions: [
      'answer_from_knowledge',
      'ask_clarifying_question',
      'verified_navigation',
      'human_handoff',
    ],
    limitUnit: 'message',
  }),
} as const satisfies Record<AttentionChannel, ChannelAgentContract>

export type ChannelAgentPolicy = {
  version: 1
  channel: AttentionChannel
  enabled: boolean
  tone: string | null
  channelPrompt: string | null
  fallbackMode: ChannelAgentFallbackMode
  permittedActions: ChannelAgentAction[]
}

export type ChannelAgentPolicyInput = {
  enabled?: boolean
  tone?: string | null
  channelPrompt?: string | null
  fallbackMode?: string | null
  permittedActions?: string[]
}

export function normalizeChannelAgentPolicy(
  channel: AttentionChannel,
  input: ChannelAgentPolicyInput,
): ChannelAgentPolicy {
  const contract = getChannelAgentContract(channel)
  const requestedActions = input.permittedActions ?? [...contract.permittedActions]
  const permittedActions = Array.from(new Set(requestedActions))
    .filter((action): action is ChannelAgentAction => contract.permittedActions.some((allowed) => allowed === action))

  return {
    version: 1,
    channel,
    enabled: input.enabled === true,
    tone: cleanOptionalText(input.tone, 80),
    channelPrompt: cleanOptionalText(input.channelPrompt, 4000),
    fallbackMode: contract.fallbackModes.some((mode) => mode === input.fallbackMode)
      ? input.fallbackMode as ChannelAgentFallbackMode
      : contract.defaultFallbackMode,
    permittedActions,
  }
}

export const ATTENTION_EVENT_TYPES = [
  'interaction_received',
  'response_completed',
  'fallback_triggered',
  'handoff_requested',
  'incident_reported',
] as const

export type AttentionEventType = typeof ATTENTION_EVENT_TYPES[number]

export type AttentionEvent = {
  version: 1
  tenantId: string
  channel: AttentionChannel
  agentKey: ChannelAgentKey
  interactionId: string
  eventType: AttentionEventType
  occurredAt: string
  reasonCode: string | null
  sourceIds: string[]
}

export function createAttentionEvent(input: {
  tenantId: string
  channel: AttentionChannel
  interactionId: string
  eventType: AttentionEventType
  occurredAt?: Date
  reasonCode?: string | null
  sourceIds?: string[]
}): AttentionEvent {
  const contract = getChannelAgentContract(input.channel)

  return {
    version: 1,
    tenantId: requireIdentifier(input.tenantId, 'tenantId'),
    channel: input.channel,
    agentKey: contract.agentKey,
    interactionId: requireIdentifier(input.interactionId, 'interactionId'),
    eventType: input.eventType,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    reasonCode: normalizeReasonCode(input.reasonCode),
    sourceIds: normalizeSourceIds(input.sourceIds),
  }
}

export function getChannelAgentContract(channel: AttentionChannel): ChannelAgentContract {
  return CHANNEL_AGENT_CONTRACTS[channel]
}

export function isAttentionChannel(value: unknown): value is AttentionChannel {
  return typeof value === 'string' && ATTENTION_CHANNELS.some((channel) => channel === value)
}

export function getAttentionUsageDimensions(channel: AttentionChannel) {
  return { moduleKey: channel, usageChannel: channel }
}

function channelContract(input: {
  channel: AttentionChannel
  mission: string
  deliveryMode: ChannelAgentDeliveryMode
  fallbackModes: readonly ChannelAgentFallbackMode[]
  defaultFallbackMode: ChannelAgentFallbackMode
  permittedActions: readonly ChannelAgentAction[]
  limitUnit: ChannelAgentLimitUnit
}): ChannelAgentContract {
  return {
    version: 1,
    channel: input.channel,
    agentKey: `${input.channel}_agent`,
    mission: input.mission,
    deliveryMode: input.deliveryMode,
    languagePolicy: 'inbound_message_with_venue_fallback',
    tonePolicy: 'channel_configured',
    knowledge: SHARED_KNOWLEDGE_POLICY,
    boundaries: CHANNEL_BOUNDARIES,
    fallbackModes: input.fallbackModes,
    defaultFallbackMode: input.defaultFallbackMode,
    permittedActions: input.permittedActions,
    limitUnit: input.limitUnit,
    contentRetentionDays: 90,
  }
}

function cleanOptionalText(value: string | null | undefined, maxLength: number) {
  const cleaned = value?.trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function requireIdentifier(value: string, field: string) {
  const cleaned = value.trim()
  if (!cleaned || cleaned.length > 128) {
    throw new Error(`${field} must contain between 1 and 128 characters`)
  }
  return cleaned
}

function normalizeReasonCode(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)

  return normalized || null
}

function normalizeSourceIds(values: string[] | undefined) {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 128),
  )).slice(0, 20)
}
