import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import { normalizeChannelAgentPolicy } from '@/lib/attention/channel-agent'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { recordUsageEvent } from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
import { z } from 'zod'
import { getWhatsappConnectionAccessToken } from './credentials'
import { sendMetaWhatsappText, type MetaWhatsappSendResult } from './meta-client'
import { requestWhatsappAgent, type WhatsappAgentClientResult, type WhatsappAgentResult } from './talia-ai'

type AdminClient = ReturnType<typeof createAdminClient>

const jobContextSchema = z.object({
  job: z.object({ id: z.string().uuid(), attempt_count: z.number().int().min(1) }),
  turn: z.object({
    job_ids: z.array(z.string().uuid()).min(1),
    message_ids: z.array(z.string().uuid()).min(1),
    message_count: z.number().int().min(1),
    ai_disclosure_required: z.boolean(),
  }),
  connection: z.object({
    id: z.string().uuid(),
    phone_number_id: z.string().min(1),
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
  contact: z.object({ id: z.string().uuid(), wa_id: z.string().min(1) }),
  conversation: z.object({
    id: z.string().uuid(),
    status: z.string(),
    metadata: z.record(z.string(), z.unknown()),
  }),
  message: z.object({
    id: z.string().uuid(),
    provider_message_id: z.string().min(1),
    body_text: z.string().trim().min(1).max(10_000),
    created_at: z.string(),
  }),
  conversation_context: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })).max(6),
  outbound: z.object({
    id: z.string().uuid(),
    body_text: z.string().trim().min(1).max(4096),
    provider_message_id: z.string().min(1),
    delivery_status: z.enum(['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown']),
    metadata: z.record(z.string(), z.unknown()),
  }).nullable(),
})

type WhatsappJobContext = z.infer<typeof jobContextSchema>

export type WhatsappProcessorSummary = {
  claimed: number
  responded: number
  handoffs: number
  retried: number
  deferred: number
  failed: number
}

const preparedTurnSchema = z.object({
  state: z.enum(['prepared', 'stale', 'invalid']),
  outbound: jobContextSchema.shape.outbound.optional(),
})

type ProcessorDependencies = {
  requestAgent?: typeof requestWhatsappAgent
  sendText?: typeof sendMetaWhatsappText
  workerId?: string
  limit?: number
  leaseSeconds?: number
  maxAttempts?: number
  resolveAccessToken?: typeof getWhatsappConnectionAccessToken
}

export async function processWhatsappInboundJobs(
  admin: AdminClient = createAdminClient(),
  dependencies: ProcessorDependencies = {},
): Promise<WhatsappProcessorSummary> {
  const workerId = dependencies.workerId ?? `whatsapp:${crypto.randomUUID()}`
  const { data, error } = await admin.rpc('claim_whatsapp_inbound_jobs', {
    p_worker_id: workerId,
    p_limit: dependencies.limit ?? 3,
    p_lease_seconds: dependencies.leaseSeconds ?? 180,
  })
  if (error) throw new Error('whatsapp_job_claim_failed')

  const summary = emptySummary(data?.length ?? 0)
  for (const job of data ?? []) {
    await processClaimedJob(admin, {
      jobId: job.job_id,
      workerId,
      attemptCount: job.attempt_count,
      requestAgent: dependencies.requestAgent ?? requestWhatsappAgent,
      sendText: dependencies.sendText ?? sendMetaWhatsappText,
      resolveAccessToken: dependencies.resolveAccessToken ?? getWhatsappConnectionAccessToken,
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
    requestAgent: typeof requestWhatsappAgent
    sendText: typeof sendMetaWhatsappText
    resolveAccessToken: typeof getWhatsappConnectionAccessToken
    maxAttempts: number
  },
  summary: WhatsappProcessorSummary,
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
    const policy = normalizeChannelAgentPolicy('whatsapp', {
      enabled: settings.enabled !== false,
      tone: getString(settings.tone),
      channelPrompt: getString(settings.channel_prompt),
      fallbackMode: getString(settings.fallback_mode),
      permittedActions: getStringArray(settings.permitted_actions),
    })
    if (!policy.enabled || !policy.permittedActions.includes('answer_from_knowledge')) {
      const outcome = await completeHandoff(
        admin,
        context,
        input,
        policy.enabled ? 'answer_action_disabled' : 'agent_disabled',
        false,
      )
      countHandoffOutcome(summary, outcome, false)
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
      const outcome = await handleAgentFailure(admin, context, input, agent)
      countFailureOutcome(summary, outcome)
      return
    }

    await recordAgentUsage(admin, context, agent.result)
    const agentMetadata = {
      ...buildAgentMetadata(agent.result),
      turn_message_count: context.turn.message_count,
    }
    if (agent.result.action === 'handoff') {
      const outcome = await completeHandoff(admin, context, input, 'agent_handoff', false, agentMetadata)
      if (outcome === 'handoff') await recordHandoffUsage(admin, context, 'agent_handoff')
      countHandoffOutcome(summary, outcome, false)
      return
    }

    if (!isAgentResponsePermitted(agent.result, policy.permittedActions)) {
      const outcome = await completeHandoff(
        admin,
        context,
        input,
        'agent_action_not_permitted',
        false,
        agentMetadata,
      )
      if (outcome === 'handoff') await recordHandoffUsage(admin, context, 'agent_action_not_permitted')
      countHandoffOutcome(summary, outcome, false)
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
    if (prepared.state !== 'prepared' || !prepared.outbound) {
      throw new Error('whatsapp_reply_prepare_invalid_result')
    }
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
    if (input.attemptCount >= input.maxAttempts) {
      const handoff = await admin.rpc('complete_whatsapp_conversation_turn_handoff', {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_reason: 'worker_unexpected_error',
        p_failed: true,
      })
      if (!handoff.error && handoff.data === 'stale') summary.deferred += 1
      else summary.failed += 1
      return
    }
    const retry = await admin.rpc('retry_whatsapp_conversation_turn', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_error_code: 'worker_unexpected_error',
      p_error_message: 'WhatsApp worker failed before a provider send was confirmed.',
      p_retry_delay_seconds: retryDelay(input.attemptCount),
    })
    if (retry.error) {
      summary.failed += 1
      return
    }
    if (retry.data === 'stale') summary.deferred += 1
    else if (retry.data === 'retry') summary.retried += 1
    else summary.failed += 1
  }
}

async function resumePreparedReply(
  admin: AdminClient,
  context: WhatsappJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  summary: WhatsappProcessorSummary,
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
    const completed = await admin.rpc('complete_whatsapp_conversation_turn', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_outbound_message_id: outbound.id,
      p_provider_message_id: outbound.provider_message_id,
      p_resolution: getResolutionFromMetadata(outbound.metadata) as Json,
      p_agent_metadata: outbound.metadata as Json,
    })
    if (completed.error || !completed.data) throw new Error('whatsapp_reply_recovery_failed')
    summary.responded += 1
    return
  }

  const outcome = await completeHandoff(
    admin,
    context,
    input,
    outbound.delivery_status === 'sending' ? 'provider_send_outcome_unknown' : 'prepared_reply_not_sendable',
    true,
    getRecord(outbound.metadata),
    outbound.id,
    outbound.delivery_status === 'sending' ? 'unknown' : 'failed',
  )
  if (outcome === 'handoff') await recordHandoffUsage(admin, context, 'provider_send_outcome_unknown')
  countHandoffOutcome(summary, outcome, true)
}

async function sendPreparedReply(
  admin: AdminClient,
  context: WhatsappJobContext,
  outbound: Pick<NonNullable<WhatsappJobContext['outbound']>, 'id' | 'body_text'>,
  input: Parameters<typeof processClaimedJob>[1],
  summary: WhatsappProcessorSummary,
  agentMetadata: Record<string, unknown>,
  resolution?: Record<string, unknown>,
) {
  const accessToken = await input.resolveAccessToken(admin, {
    tenantId: context.tenant.id,
    phoneNumberId: context.connection.phone_number_id,
  })
  const started = await admin.rpc('start_whatsapp_conversation_turn_send', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_outbound_message_id: outbound.id,
  })
  if (started.error) throw new Error('whatsapp_send_start_failed')
  if (started.data === 'stale') {
    summary.deferred += 1
    return
  }
  if (started.data !== 'started') throw new Error('whatsapp_send_start_failed')

  const sendResult = await input.sendText({
    phoneNumberId: context.connection.phone_number_id,
    recipientWaId: context.contact.wa_id,
    body: outbound.body_text,
    replyToProviderMessageId: context.message.provider_message_id,
  }, { accessToken })

  if (sendResult.ok) {
    const completed = await admin.rpc('complete_whatsapp_conversation_turn', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_outbound_message_id: outbound.id,
      p_provider_message_id: sendResult.providerMessageId,
      p_resolution: (resolution ?? null) as Json,
      p_agent_metadata: agentMetadata as Json,
    })
    if (completed.error || !completed.data) {
      await markUnknownOutcome(admin, context, input, outbound.id, agentMetadata, 'provider_confirmed_database_failed')
      summary.failed += 1
      return
    }
    await recordOutboundUsage(admin, context, outbound.id)
    summary.responded += 1
    return
  }

  await handleSendFailure(admin, context, outbound.id, input, summary, agentMetadata, sendResult)
}

async function handleSendFailure(
  admin: AdminClient,
  context: WhatsappJobContext,
  outboundId: string,
  input: Parameters<typeof processClaimedJob>[1],
  summary: WhatsappProcessorSummary,
  agentMetadata: Record<string, unknown>,
  result: Exclude<MetaWhatsappSendResult, { ok: true }>,
) {
  if (result.outcome === 'transient_rejection' && input.attemptCount < input.maxAttempts) {
    const retry = await admin.rpc('retry_whatsapp_conversation_turn', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_outbound_message_id: outboundId,
      p_error_code: result.errorCode,
      p_error_message: 'Meta rejected the request with a retryable response.',
      p_retry_delay_seconds: retryDelay(input.attemptCount),
    })
    if (retry.error) throw new Error('whatsapp_send_retry_failed')
    if (retry.data === 'stale') summary.deferred += 1
    else if (retry.data === 'retry') summary.retried += 1
    else throw new Error('whatsapp_send_retry_failed')
    return
  }

  const unknown = result.outcome === 'uncertain'
  const outcome = await completeHandoff(
    admin,
    context,
    input,
    unknown ? 'provider_send_outcome_unknown' : result.errorCode,
    true,
    agentMetadata,
    outboundId,
    unknown ? 'unknown' : 'failed',
  )
  if (outcome === 'handoff') {
    await recordHandoffUsage(admin, context, unknown ? 'provider_send_outcome_unknown' : result.errorCode)
  }
  countHandoffOutcome(summary, outcome, true)
}

async function handleAgentFailure(
  admin: AdminClient,
  context: WhatsappJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  result: Exclude<WhatsappAgentClientResult, { ok: true }>,
) {
  if (result.retryable && input.attemptCount < input.maxAttempts) {
    const retry = await admin.rpc('retry_whatsapp_conversation_turn', {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_error_code: result.errorCode,
      p_error_message: 'WhatsApp agent request failed before any provider side effect.',
      p_retry_delay_seconds: retryDelay(input.attemptCount),
    })
    if (retry.error || !['retry', 'stale'].includes(retry.data ?? '')) {
      throw new Error('whatsapp_agent_retry_failed')
    }
    return retry.data as 'retry' | 'stale'
  }

  const outcome = await completeHandoff(admin, context, input, result.errorCode, true)
  if (outcome === 'handoff') await recordHandoffUsage(admin, context, result.errorCode)
  return outcome
}

async function loadJobContext(admin: AdminClient, jobId: string, workerId: string) {
  const { data, error } = await admin.rpc('get_whatsapp_inbound_job_context', {
    p_job_id: jobId,
    p_worker_id: workerId,
  })
  if (error) throw new Error('whatsapp_job_context_failed')
  const parsed = jobContextSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

async function prepareReply(
  admin: AdminClient,
  input: Parameters<typeof processClaimedJob>[1],
  reply: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc('prepare_whatsapp_conversation_turn', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_reply: reply,
    p_agent_metadata: metadata as Json,
  })
  if (error) throw new Error('whatsapp_reply_prepare_failed')
  const parsed = preparedTurnSchema.safeParse(data)
  if (!parsed.success) throw new Error('whatsapp_reply_prepare_invalid_result')
  return parsed.data
}

async function completeHandoff(
  admin: AdminClient,
  _context: WhatsappJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  reason: string,
  failed: boolean,
  metadata: Record<string, unknown> = {},
  outboundMessageId?: string,
  outboundDeliveryStatus?: 'failed' | 'unknown',
) {
  const result = await admin.rpc('complete_whatsapp_conversation_turn_handoff', {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_reason: reason,
    p_agent_metadata: metadata as Json,
    p_failed: failed,
    ...(outboundMessageId ? { p_outbound_message_id: outboundMessageId } : {}),
    ...(outboundDeliveryStatus ? { p_outbound_delivery_status: outboundDeliveryStatus } : {}),
  })
  if (result.error || !['handoff', 'stale'].includes(result.data ?? '')) {
    throw new Error('whatsapp_handoff_complete_failed')
  }
  return result.data as 'handoff' | 'stale'
}

async function markUnknownOutcome(
  admin: AdminClient,
  context: WhatsappJobContext,
  input: Parameters<typeof processClaimedJob>[1],
  outboundMessageId: string,
  metadata: Record<string, unknown>,
  reason: string,
) {
  await completeHandoff(admin, context, input, reason, true, metadata, outboundMessageId, 'unknown')
  await recordHandoffUsage(admin, context, reason)
}

function buildAgentMetadata(result: WhatsappAgentResult) {
  return {
    agent: 'whatsapp_agent',
    provider: result.provider,
    model: result.model,
    response_kind: getString(result.metadata.response_kind),
    response_language: getString(result.metadata.response_language),
    resolution: getResolution(result) ?? null,
    source_ids: result.sources.map((source) => source.id).slice(0, 10),
    usage_summary: result.usage_summary,
  }
}

function isAgentResponsePermitted(result: WhatsappAgentResult, permittedActions: string[]) {
  const kind = getString(result.metadata.response_kind)
  if (kind === 'clarification') return permittedActions.includes('ask_clarifying_question')
  return permittedActions.includes('answer_from_knowledge')
}

function getResolution(result: WhatsappAgentResult) {
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

async function recordInboundUsage(admin: AdminClient, context: WhatsappJobContext) {
  await Promise.all(context.turn.message_ids.map((messageId) => recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'whatsapp',
    channel: 'whatsapp',
    eventType: 'message',
    unit: 'message',
    idempotencyKey: `whatsapp:${messageId}:inbound`,
    metadata: {
      direction: 'inbound',
      agent: 'whatsapp_agent',
      attention_event: 'interaction_received',
      turn_message_count: context.turn.message_count,
    },
  })))
}

async function recordAgentUsage(admin: AdminClient, context: WhatsappJobContext, result: WhatsappAgentResult) {
  const total = result.usage_summary
  const event = await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'whatsapp',
    channel: 'whatsapp',
    eventType: 'ai_call',
    quantity: total.request_count,
    unit: 'call',
    inputTokens: total.input_tokens,
    outputTokens: total.output_tokens,
    idempotencyKey: `whatsapp:${context.message.id}:ai_call`,
    metadata: {
      agent: 'whatsapp_agent',
      accuracy: 'measured',
      component_count: result.usage_components.length,
    },
  })
  if (!event.ok || !event.eventId) return

  await recordMeasuredAiUsage(admin, {
    tenantId: context.tenant.id,
    sessionId: context.conversation.id,
    usageEventId: event.eventId,
    idempotencyPrefix: `whatsapp:${context.message.id}:component`,
    components: result.usage_components as ChatAiUsageComponent[],
    metadata: { channel: 'whatsapp', agent: 'whatsapp_agent' },
  })
}

async function recordOutboundUsage(admin: AdminClient, context: WhatsappJobContext, outboundMessageId: string) {
  await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'whatsapp',
    channel: 'whatsapp',
    eventType: 'message',
    unit: 'message',
    idempotencyKey: `whatsapp:${outboundMessageId}:outbound`,
    metadata: {
      direction: 'outbound',
      agent: 'whatsapp_agent',
      attention_event: 'response_completed',
    },
  })
}

async function recordHandoffUsage(admin: AdminClient, context: WhatsappJobContext, reason: string) {
  await recordUsageEvent(admin, {
    tenantId: context.tenant.id,
    moduleKey: 'whatsapp',
    channel: 'whatsapp',
    eventType: 'fallback',
    unit: 'event',
    idempotencyKey: `whatsapp:${context.message.id}:handoff`,
    metadata: {
      agent: 'whatsapp_agent',
      attention_event: 'handoff_requested',
      reason: reason.slice(0, 100),
    },
  })
}

function emptySummary(claimed: number): WhatsappProcessorSummary {
  return { claimed, responded: 0, handoffs: 0, retried: 0, deferred: 0, failed: 0 }
}

function countHandoffOutcome(
  summary: WhatsappProcessorSummary,
  outcome: 'handoff' | 'stale',
  failed: boolean,
) {
  if (outcome === 'stale') summary.deferred += 1
  else if (failed) summary.failed += 1
  else summary.handoffs += 1
}

function countFailureOutcome(
  summary: WhatsappProcessorSummary,
  outcome: 'retry' | 'handoff' | 'stale',
) {
  if (outcome === 'retry') summary.retried += 1
  else if (outcome === 'stale') summary.deferred += 1
  else summary.failed += 1
}

function buildCustomerResponse(
  context: WhatsappJobContext,
  reply: string,
  responseLanguage: string | null,
) {
  const normalizedReply = reply.trim().slice(0, 4096)
  if (!context.turn.ai_disclosure_required) {
    return { body: normalizedReply, disclosureIncluded: false }
  }

  if (containsAiDisclosure(normalizedReply)) {
    return { body: normalizedReply, disclosureIncluded: true }
  }

  const disclosure = getAiDisclosure(
    responseLanguage ?? context.tenant.fallback_language,
    context.tenant.name,
  )
  const replyWithoutGreeting = stripLeadingGreeting(reply)
  const availableReplyLength = Math.max(0, 4096 - disclosure.length - 2)
  const trimmedReply = replyWithoutGreeting.slice(0, availableReplyLength).trimEnd()
  return {
    body: trimmedReply ? `${disclosure}\n\n${trimmedReply}` : disclosure,
    disclosureIncluded: true,
  }
}

function containsAiDisclosure(reply: string) {
  const normalized = reply
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const identifiesTalia = /\b(?:soy|soc|sou(?: a)?|i am|i m|je suis)\s+(?:la\s+)?talia\b/u.test(normalized)
  const identifiesAi = /\b(?:ia|ai|inteligencia artificial|intelligencia artificial|intelligence artificielle|asistente virtual|assistent virtual|assistente virtual|virtual assistant)\b/u.test(normalized)
  return identifiesTalia && identifiesAi
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
  if (normalized.startsWith('ca')) {
    return `Hola! Soc Talía, un agent d'IA per a ${safeTenantName}.`
  }
  if (normalized.startsWith('pt')) {
    return `Olá! Sou a Talía, uma agente de IA para ${safeTenantName}.`
  }
  if (normalized.startsWith('en')) {
    return `Hi! I'm Talía, an AI agent for ${safeTenantName}.`
  }
  return `¡Hola! Soy Talía, un agente de IA para ${safeTenantName}.`
}

function retryDelay(attemptCount: number) {
  return Math.min(900, 30 * (2 ** Math.max(0, attemptCount - 1)))
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
  return value === 'balanced' || value === 'strict' ? value : undefined
}
