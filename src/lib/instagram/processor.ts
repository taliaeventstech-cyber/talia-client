import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import { normalizeChannelAgentPolicy } from '@/lib/attention/channel-agent'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { recordUsageEvent } from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
import { z } from 'zod'
import { getInstagramConnectionAccessToken } from './credentials'
import { sendMetaInstagramText, type MetaInstagramSendResult } from './meta-client'
import {
  requestInstagramAgent,
  type InstagramAgentClientResult,
  type InstagramAgentResult,
} from './talia-ai'

type AdminClient = ReturnType<typeof createAdminClient>

const jobContextSchema = z.object({
  job: z.object({ id: z.string().uuid(), attempt_count: z.number().int().min(1) }),
  connection: z.object({
    id: z.string().uuid(),
    instagram_user_id: z.string().min(1),
    status: z.literal('connected'),
    rollout_enabled: z.literal(true),
    metadata: z.record(z.string(), z.unknown()),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    fallback_language: z.string().min(2).max(10),
    fallback_email: z.string().email().nullable(),
    fallback_phone: z.string().nullable(),
  }),
  contact: z.object({
    id: z.string().uuid(),
    instagram_scoped_user_id: z.string().min(1),
  }),
  conversation: z.object({
    id: z.string().uuid(),
    status: z.string(),
    metadata: z.record(z.string(), z.unknown()),
  }),
  message: z.object({
    id: z.string().uuid(),
    provider_message_id: z.string().min(1),
    body_text: z.string().trim().min(1).max(16_000),
    created_at: z.string(),
  }),
  conversation_context: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })).max(6),
  ai_disclosure_required: z.boolean(),
  outbound: z.object({
    id: z.string().uuid(),
    body_text: z.string().trim().min(1).max(1_000),
    provider_message_id: z.string().min(1),
    delivery_status: z.enum(['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown']),
    metadata: z.record(z.string(), z.unknown()),
  }).nullable(),
})

type InstagramJobContext = z.infer<typeof jobContextSchema>

const preparedReplySchema = z.object({
  state: z.enum(['prepared', 'stale']),
  outbound: jobContextSchema.shape.outbound.unwrap().optional(),
})

export type InstagramProcessorSummary = {
  claimed: number
  responded: number
  handoffs: number
  retried: number
  deferred: number
  failed: number
}

type ProcessorDependencies = {
  requestAgent?: typeof requestInstagramAgent
  sendText?: typeof sendMetaInstagramText
  resolveAccessToken?: typeof getInstagramConnectionAccessToken
  workerId?: string
  limit?: number
  leaseSeconds?: number
  maxAttempts?: number
}

export async function processInstagramInboundJobs(
  admin: AdminClient = createAdminClient(),
  dependencies: ProcessorDependencies = {},
): Promise<InstagramProcessorSummary> {
  const workerId = dependencies.workerId ?? `instagram:${crypto.randomUUID()}`
  const { data, error } = await admin.rpc('claim_instagram_inbound_jobs', {
    p_worker_id: workerId,
    p_limit: dependencies.limit ?? 3,
    p_lease_seconds: dependencies.leaseSeconds ?? 180,
  })
  if (error) throw new Error('instagram_job_claim_failed')

  const summary = emptySummary(data?.length ?? 0)
  for (const job of data ?? []) {
    await processClaimedJob(admin, {
      jobId: job.job_id,
      workerId,
      attemptCount: job.attempt_count,
      requestAgent: dependencies.requestAgent ?? requestInstagramAgent,
      sendText: dependencies.sendText ?? sendMetaInstagramText,
      resolveAccessToken: dependencies.resolveAccessToken ?? getInstagramConnectionAccessToken,
      maxAttempts: dependencies.maxAttempts ?? 3,
    }, summary)
  }
  return summary
}

async function processClaimedJob(
  admin: AdminClient,
  input: {
    jobId: string
    workerId: string
    attemptCount: number
    requestAgent: typeof requestInstagramAgent
    sendText: typeof sendMetaInstagramText
    resolveAccessToken: typeof getInstagramConnectionAccessToken
    maxAttempts: number
  },
  summary: InstagramProcessorSummary,
) {
  try {
    const context = await loadJobContext(admin, input.jobId, input.workerId)
    if (!context) {
      summary.failed += 1
      return
    }
    input.attemptCount = Math.max(input.attemptCount, context.job.attempt_count)
    await recordInboundUsage(admin, context)

    if (context.outbound) {
      await resumePreparedReply(admin, context, input, summary)
      return
    }

    const settings = getRecord(context.connection.metadata.agent_settings)
    const policy = normalizeChannelAgentPolicy('instagram', {
      enabled: settings.enabled !== false,
      tone: getString(settings.tone),
      channelPrompt: getString(settings.channel_prompt),
      fallbackMode: getString(settings.fallback_mode),
      permittedActions: getStringArray(settings.permitted_actions),
    })
    if (!policy.enabled || !policy.permittedActions.includes('answer_from_knowledge')) {
      await finishHandoff(admin, context, input, summary, policy.enabled ? 'answer_action_disabled' : 'agent_disabled')
      return
    }

    const agent = await input.requestAgent({
      tenantId: context.tenant.id,
      connectionId: context.connection.id,
      conversationId: context.conversation.id,
      messageId: context.message.id,
      message: context.message.body_text,
      fallbackLanguage: context.tenant.fallback_language,
      conversationContext: context.conversation_context,
      previousResolution: getPreviousResolution(context.conversation.metadata),
      tenant: {
        name: context.tenant.name,
        fallbackEmail: context.tenant.fallback_email,
        fallbackPhone: context.tenant.fallback_phone,
      },
      policy,
      fallbackMessage: getString(settings.fallback_message),
      aiSettings: {
        temperature: getNumber(settings.temperature),
        groundingMode: getGroundingMode(settings.grounding_mode),
        minContextScore: getNumber(settings.min_context_score),
        maxContextItems: getNumber(settings.max_context_items),
      },
    })

    if (!agent.ok) {
      await handleAgentFailure(admin, context, input, summary, agent)
      return
    }

    await recordAgentUsage(admin, context, agent.result)
    const agentMetadata = buildAgentMetadata(agent.result)
    if (agent.result.action === 'handoff' || !isAgentResponsePermitted(agent.result, policy.permittedActions)) {
      await finishHandoff(
        admin,
        context,
        input,
        summary,
        agent.result.action === 'handoff' ? 'agent_handoff' : 'agent_action_not_permitted',
        false,
        agentMetadata,
      )
      return
    }

    const response = buildCustomerResponse(
      context,
      agent.result.reply!,
      getString(agent.result.metadata.response_language),
    )
    const finalMetadata = {
      ...agentMetadata,
      ...(response.disclosureIncluded ? {
        ai_disclosure_included: true,
        ai_disclosure_version: 1,
      } : {}),
    }
    const prepared = await prepareReply(admin, input, response.body, finalMetadata)
    if (prepared.state === 'stale') {
      summary.deferred += 1
      return
    }
    if (!prepared.outbound) throw new Error('instagram_reply_prepare_invalid_result')

    await sendPreparedReply(
      admin,
      context,
      prepared.outbound,
      input,
      summary,
      finalMetadata,
      getResolution(agent.result),
    )
  } catch {
    await retryOrFailBeforeSend(admin, input, summary, 'worker_unexpected_error')
  }
}

async function resumePreparedReply(
  admin: AdminClient,
  context: InstagramJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
) {
  const outbound = context.outbound!
  if (outbound.delivery_status === 'queued') {
    await sendPreparedReply(
      admin,
      context,
      outbound,
      input,
      summary,
      getRecord(outbound.metadata),
      getResolutionFromMetadata(outbound.metadata),
    )
    return
  }
  if (['sent', 'delivered', 'read'].includes(outbound.delivery_status)) {
    const completed = await admin.rpc('complete_instagram_agent_reply', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_outbound_message_id: outbound.id,
      p_provider_message_id: outbound.provider_message_id,
      p_resolution: (getResolutionFromMetadata(outbound.metadata) ?? null) as Json,
      p_agent_metadata: outbound.metadata as Json,
    })
    if (completed.error || !completed.data) throw new Error('instagram_reply_recovery_failed')
    summary.responded += 1
    return
  }

  await finishHandoff(
    admin,
    context,
    input,
    summary,
    outbound.delivery_status === 'sending' ? 'provider_send_outcome_unknown' : 'prepared_reply_not_sendable',
    true,
    getRecord(outbound.metadata),
    outbound.id,
    outbound.delivery_status === 'sending' ? 'unknown' : 'failed',
  )
}

async function sendPreparedReply(
  admin: AdminClient,
  context: InstagramJobContext,
  outbound: Pick<NonNullable<InstagramJobContext['outbound']>, 'id' | 'body_text'>,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
  agentMetadata: Record<string, unknown>,
  resolution?: Record<string, unknown>,
) {
  let accessToken: string
  try {
    accessToken = await input.resolveAccessToken(admin, {
      tenantId: context.tenant.id,
      instagramUserId: context.connection.instagram_user_id,
    })
  } catch {
    await finishHandoff(admin, context, input, summary, 'instagram_credentials_unavailable', true, agentMetadata, outbound.id, 'failed')
    return
  }

  const started = await admin.rpc('start_instagram_agent_send', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_outbound_message_id: outbound.id,
  })
  if (started.error) throw new Error('instagram_send_start_failed')
  if (started.data === 'stale') {
    summary.deferred += 1
    return
  }
  if (started.data !== 'started') throw new Error('instagram_send_start_failed')

  let result: MetaInstagramSendResult
  try {
    result = await input.sendText({
      instagramUserId: context.connection.instagram_user_id,
      recipientInstagramScopedId: context.contact.instagram_scoped_user_id,
      body: outbound.body_text,
    }, { accessToken })
  } catch {
    await finishHandoff(
      admin,
      context,
      input,
      summary,
      'provider_send_outcome_unknown',
      true,
      agentMetadata,
      outbound.id,
      'unknown',
    )
    return
  }

  if (result.ok) {
    const completed = await admin.rpc('complete_instagram_agent_reply', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_outbound_message_id: outbound.id,
      p_provider_message_id: result.providerMessageId,
      p_resolution: (resolution ?? null) as Json,
      p_agent_metadata: agentMetadata as Json,
    })
    if (completed.error || !completed.data) {
      await finishHandoff(admin, context, input, summary, 'provider_confirmed_database_failed', true, agentMetadata, outbound.id, 'unknown')
      return
    }
    await recordOutboundUsage(admin, context, outbound.id)
    summary.responded += 1
    return
  }

  await handleSendFailure(admin, context, outbound.id, input, summary, agentMetadata, result)
}

async function handleSendFailure(
  admin: AdminClient,
  context: InstagramJobContext,
  outboundId: string,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
  agentMetadata: Record<string, unknown>,
  result: Exclude<MetaInstagramSendResult, { ok: true }>,
) {
  const unknown = result.outcome !== 'definitive_rejection'
  await finishHandoff(
    admin,
    context,
    input,
    summary,
    unknown ? 'provider_send_outcome_unknown' : result.errorCode,
    true,
    agentMetadata,
    outboundId,
    unknown ? 'unknown' : 'failed',
  )
}

async function handleAgentFailure(
  admin: AdminClient,
  context: InstagramJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
  result: Exclude<InstagramAgentClientResult, { ok: true }>,
) {
  if (result.retryable && input.attemptCount < input.maxAttempts) {
    await retryOrFailBeforeSend(admin, input, summary, result.errorCode)
    return
  }
  await finishHandoff(admin, context, input, summary, result.errorCode, true)
}

async function retryOrFailBeforeSend(
  admin: AdminClient,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
  reason: string,
) {
  if (input.attemptCount >= input.maxAttempts) {
    const handoff = await admin.rpc('complete_instagram_agent_handoff', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_reason: reason,
      p_agent_metadata: {},
      p_failed: true,
    })
    if (!handoff.error && handoff.data === 'stale') summary.deferred += 1
    else summary.failed += 1
    return
  }
  const retry = await admin.rpc('retry_instagram_agent_reply', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_error_code: reason,
    p_error_message: 'Instagram worker failed before a provider send was started.',
    p_retry_delay_seconds: retryDelay(input.attemptCount),
  })
  if (retry.error || retry.data === 'send_started') summary.failed += 1
  else if (retry.data === 'stale') summary.deferred += 1
  else if (retry.data === 'retry') summary.retried += 1
  else summary.failed += 1
}

async function loadJobContext(admin: AdminClient, jobId: string, workerId: string) {
  const { data, error } = await admin.rpc('get_instagram_inbound_job_context', {
    p_job_id: jobId,
    p_worker_id: workerId,
  })
  if (error) throw new Error('instagram_job_context_failed')
  const parsed = jobContextSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

async function prepareReply(
  admin: AdminClient,
  input: Parameters<typeof processClaimedJob>[1],
  reply: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc('prepare_instagram_agent_reply', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_reply: reply,
    p_agent_metadata: metadata as Json,
  })
  if (error) throw new Error('instagram_reply_prepare_failed')
  const parsed = preparedReplySchema.safeParse(data)
  if (!parsed.success) throw new Error('instagram_reply_prepare_invalid_result')
  return parsed.data
}

async function finishHandoff(
  admin: AdminClient,
  context: InstagramJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  summary: InstagramProcessorSummary,
  reason: string,
  failed = false,
  metadata: Record<string, unknown> = {},
  outboundMessageId?: string,
  outboundDeliveryStatus?: 'failed' | 'unknown',
) {
  const result = await admin.rpc('complete_instagram_agent_handoff', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_reason: reason,
    p_agent_metadata: metadata as Json,
    p_failed: failed,
    ...(outboundMessageId ? { p_outbound_message_id: outboundMessageId } : {}),
    ...(outboundDeliveryStatus ? { p_outbound_delivery_status: outboundDeliveryStatus } : {}),
  })
  if (result.error || !['handoff', 'stale'].includes(result.data ?? '')) {
    summary.failed += 1
    return
  }
  if (result.data === 'stale') {
    summary.deferred += 1
    return
  }
  await recordHandoffUsage(admin, context, reason)
  if (failed) summary.failed += 1
  else summary.handoffs += 1
}

function buildAgentMetadata(result: InstagramAgentResult) {
  return {
    ...result.metadata,
    agent: 'instagram_agent',
    provider: result.provider,
    model: result.model,
    response_kind: getString(result.metadata.response_kind),
    response_language: getString(result.metadata.response_language),
    resolution: getResolution(result) ?? null,
    source_ids: result.sources.map((source) => source.source_id ?? source.id).slice(0, 10),
    agent_sources: result.sources.slice(0, 10).map((source) => ({
      id: source.id,
      source_id: source.source_id,
      source_type: source.source_type,
      score: source.score,
    })),
    usage_summary: result.usage_summary,
  }
}

function isAgentResponsePermitted(result: InstagramAgentResult, permittedActions: string[]) {
  const kind = getString(result.metadata.response_kind)
  if (kind === 'clarification') return permittedActions.includes('ask_clarifying_question')
  return permittedActions.includes('answer_from_knowledge')
}

function getResolution(result: InstagramAgentResult) {
  return getRecordOrUndefined(result.metadata.resolution)
}

function getResolutionFromMetadata(metadata: Record<string, unknown>) {
  return getRecordOrUndefined(metadata.resolution)
}

function getPreviousResolution(metadata: Record<string, unknown>) {
  const value = getRecordOrUndefined(metadata.last_agent_resolution)
  if (!value || value.version !== 1 || typeof value.state !== 'string') return undefined
  return value
}

async function recordInboundUsage(admin: AdminClient, context: InstagramJobContext) {
  await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'instagram',
    channel: 'instagram',
    eventType: 'message',
    unit: 'message',
    idempotencyKey: `instagram:${context.message.id}:inbound`,
    metadata: {
      direction: 'inbound',
      agent: 'instagram_agent',
      attention_event: 'interaction_received',
    },
  })
}

async function recordAgentUsage(admin: AdminClient, context: InstagramJobContext, result: InstagramAgentResult) {
  const total = result.usage_summary
  const event = await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'instagram',
    channel: 'instagram',
    eventType: 'ai_call',
    quantity: total.request_count,
    unit: 'call',
    inputTokens: total.input_tokens,
    outputTokens: total.output_tokens,
    idempotencyKey: `instagram:${context.message.id}:ai_call`,
    metadata: {
      agent: 'instagram_agent',
      accuracy: 'measured',
      component_count: result.usage_components.length,
    },
  })
  if (!event.ok || !event.eventId) return
  await recordMeasuredAiUsage(admin, {
    tenantId: context.tenant.id,
    sessionId: context.conversation.id,
    usageEventId: event.eventId,
    idempotencyPrefix: `instagram:${context.message.id}:component`,
    components: result.usage_components as ChatAiUsageComponent[],
    metadata: { channel: 'instagram', agent: 'instagram_agent' },
  })
}

async function recordOutboundUsage(admin: AdminClient, context: InstagramJobContext, outboundMessageId: string) {
  await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'instagram',
    channel: 'instagram',
    eventType: 'message',
    unit: 'message',
    idempotencyKey: `instagram:${outboundMessageId}:outbound`,
    metadata: {
      direction: 'outbound',
      agent: 'instagram_agent',
      attention_event: 'response_completed',
    },
  })
}

async function recordHandoffUsage(admin: AdminClient, context: InstagramJobContext, reason: string) {
  await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'instagram',
    channel: 'instagram',
    eventType: 'fallback',
    unit: 'event',
    idempotencyKey: `instagram:${context.message.id}:handoff`,
    metadata: {
      agent: 'instagram_agent',
      attention_event: 'handoff_requested',
      reason: reason.slice(0, 100),
    },
  })
}

function buildCustomerResponse(
  context: InstagramJobContext,
  reply: string,
  responseLanguage: string | null,
) {
  const normalizedReply = reply.trim().slice(0, 1_000)
  if (!context.ai_disclosure_required) {
    return { body: normalizedReply, disclosureIncluded: false }
  }
  if (containsAiDisclosure(normalizedReply)) {
    return { body: normalizedReply, disclosureIncluded: true }
  }

  const disclosure = getAiDisclosure(responseLanguage ?? context.tenant.fallback_language, context.tenant.name)
  const availableReplyLength = Math.max(0, 1_000 - disclosure.length - 2)
  const trimmedReply = stripLeadingGreeting(reply).slice(0, availableReplyLength).trimEnd()
  return {
    body: trimmedReply ? `${disclosure}\n\n${trimmedReply}` : disclosure,
    disclosureIncluded: true,
  }
}

function containsAiDisclosure(reply: string) {
  const normalized = reply.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
  return /\b(?:soy|soc|sou(?: a)?|i am|i m|je suis)\s+(?:la\s+)?talia\b/u.test(normalized)
    && /\b(?:ia|ai|inteligencia artificial|intelligencia artificial|intelligence artificielle|asistente virtual|assistent virtual|assistente virtual|virtual assistant)\b/u.test(normalized)
}

function stripLeadingGreeting(reply: string) {
  return reply.trim().replace(
    /^(?:¡\s*)?(?:hola|hello|hi|hey|olá|oi)(?=\s|[!,.:—-]|$)(?:\s*[!,.:—-]+)?\s*/iu,
    '',
  )
}

function getAiDisclosure(language: string, tenantName: string) {
  const normalized = language.toLowerCase()
  const safeTenantName = tenantName.trim().slice(0, 200)
  if (normalized.startsWith('ca')) return `Hola! Soc Talía, un agent d'IA per a ${safeTenantName}.`
  if (normalized.startsWith('pt')) return `Olá! Sou a Talía, uma agente de IA para ${safeTenantName}.`
  if (normalized.startsWith('en')) return `Hi! I'm Talía, an AI agent for ${safeTenantName}.`
  return `¡Hola! Soy Talía, un agente de IA para ${safeTenantName}.`
}

function retryDelay(attemptCount: number) {
  return Math.min(900, 30 * (2 ** Math.max(0, attemptCount - 1)))
}

function emptySummary(claimed: number): InstagramProcessorSummary {
  return { claimed, responded: 0, handoffs: 0, retried: 0, deferred: 0, failed: 0 }
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function getRecordOrUndefined(value: unknown) {
  const record = getRecord(value)
  return Object.keys(record).length ? record : undefined
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getGroundingMode(value: unknown) {
  return value === 'strict' || value === 'balanced' ? value : undefined
}
