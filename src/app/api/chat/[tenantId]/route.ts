import { getRecentConversationState, saveConversation } from '@/lib/chat/service'
import { getFallbackChatAnalytics, parseChatAnalytics, saveConversationTopic } from '@/lib/analytics/topics'
import { isTaliaAiPrimaryProvider, runChatAgent, type ChatAgentPendingClarification } from '@/lib/agent-runtime/chat'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { buildRelevantKnowledgeHints, retrieveTenantKnowledge } from '@/lib/knowledge/retrieval'
import { detectChatLanguage } from '@/lib/chat/language'
import { summarizeVerifiedChatActions } from '@/lib/chat/agent-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import type { Json } from '@/types/database.types'
import type { ChatAiUsageComponent } from '@/lib/agent-runtime/chat'
import { recordMeasuredAiUsage } from '@/lib/usage/ai-cost'
import { consumeRateLimit, getClientIp } from '@/lib/auth/security'
import {
  checkTenantLimit,
  estimateOpenAiTextCostCents,
  estimateTokenCount,
  recordUsageEvent,
} from '@/lib/usage/service'
import {
  validateSuggestedQuestionSelection,
  type SuggestedQuestionSelectionInput,
  type VisibleSuggestedQuestion,
} from '@/lib/widget/suggested-questions'

type ChatPayload = {
  session_id?: string
  sessionId?: string
  message?: string
  page_url?: string
  pageUrl?: string
  suggested_question?: SuggestedQuestionSelectionInput
}

type AgentSourceSummary = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
}

type RetrievalTraceChunk = {
  id: string | null
  source_id: string | null
  source_type: string | null
  score: number | null
  rank: number | null
  used: boolean | null
  language: string | null
  preview: string | null
}

type RetrievalTrace = {
  status: string | null
  query_language: string | null
  top_score: number | null
  chunks: RetrievalTraceChunk[]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as ChatPayload
  const sessionId = payload.session_id ?? payload.sessionId
  const message = payload.message?.trim()
  const pageUrl = normalizePageUrl(payload.page_url ?? payload.pageUrl)

  if (!sessionId || !message) {
    return corsJson({ error: 'session_id and message are required' }, { status: 400 })
  }

  const limited = await consumeRateLimit([
    {
      key: `chat-minute:${tenantId}:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60_000,
    },
    {
      key: `chat-ten-minutes:${tenantId}:${getClientIp(request)}`,
      limit: 120,
      windowMs: 10 * 60_000,
    },
  ])
  if (limited) {
    return corsJson(
      { error: limited.unavailable ? 'rate_limit_unavailable' : 'too_many_attempts' },
      {
        status: limited.unavailable ? 503 : 429,
        headers: limited.unavailable ? undefined : {
          'Retry-After': String(limited.retryAfterSeconds),
        },
      },
    )
  }

  const admin = createAdminClient()
  const tenant = await getTenantChatConfig(admin, tenantId)

  if (!tenant.ok) {
    return corsJson({ error: tenant.error }, { status: 404 })
  }

  const domainSettings = await getTenantWidgetDomainSettings(admin, tenantId)
  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  const suggestedQuestion = validateSuggestedQuestionSelection(
    tenant.config.suggestedQuestions,
    payload.suggested_question,
    message,
    tenant.config.language,
    pageUrl,
  )
  const suggestedQuestionTrace = getSuggestedQuestionTrace(suggestedQuestion)

  // Botsonic model: the reply we are about to generate is the billable unit, so
  // the limit is checked on every incoming message (not only on new conversations).
  const limit = await checkTenantLimit(admin, {
    tenantId,
    channel: 'chatbot',
    projectedQuantity: 1,
  })

  if (limit.ok && !limit.allowed) {
    await recordUsageEvent(admin, {
      tenantId,
      moduleKey: 'chatbot',
      channel: 'chatbot',
      eventType: 'limit_exceeded',
      unit: 'event',
      metadata: {
        current: limit.current,
        limit: limit.limit,
        behavior: limit.behavior,
      },
    })

    if (limit.behavior === 'block') {
      return corsJson({
        error: 'Chatbot usage limit reached for this tenant',
        code: 'usage_limit_reached',
      }, { status: 402 })
    }

    // Graceful fallback: reply with the venue fallback message (no model call,
    // not billable) instead of going silent once the allotment is consumed.
    const fallbackReply = buildLimitFallbackMessage(tenant.config, tenant.config.language)
    const fallbackMetadata = {
      source: 'usage_limit_fallback',
      user_message: message,
      response_language: tenant.config.language,
      tenant_fallback_language: tenant.config.language,
      retrieval_status: 'not_run',
      fallback_reason: 'usage_limit_reached',
      ...suggestedQuestionTrace,
      limit: limit.limit,
      current: limit.current,
    } satisfies Record<string, Json>

    const [saveResult] = await Promise.all([
      saveConversation(admin, {
        tenantId,
        sessionId,
        messages: [
          { role: 'user', content: message, metadata: suggestedQuestionTrace },
          { role: 'assistant', content: fallbackReply, metadata: fallbackMetadata },
        ],
        metadata: fallbackMetadata,
      }),
      recordUsageEvent(admin, {
        tenantId,
        moduleKey: 'chatbot',
        channel: 'chatbot',
        eventType: 'fallback',
        unit: 'event',
        metadata: {
          session_id: sessionId,
          reason: 'usage_limit_reached',
        },
      }),
    ])
    const assistantMessageId = saveResult.ok
      ? saveResult.messages.find((item) => item.role === 'assistant')?.id
      : undefined

    return corsJson({
      reply: fallbackReply,
      session_id: sessionId,
      assistant_message_id: assistantMessageId,
      limited: true,
      source: { type: 'usage_limit_fallback' },
    })
  }

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message,
    phase: 'user_message',
    metadata: suggestedQuestionTrace,
  })

  const shouldDelegateKnowledgeToTaliaAi = isTaliaAiPrimaryProvider()
  const recentConversation = shouldDelegateKnowledgeToTaliaAi
    ? await getRecentConversationState(admin, tenantId, sessionId)
    : { messages: [], latestAssistantMetadata: undefined }
  const legacyVisitorLanguage = shouldDelegateKnowledgeToTaliaAi
    ? null
    : detectChatLanguage(message, tenant.config.language)
  const pendingClarification = shouldDelegateKnowledgeToTaliaAi
    ? extractPendingClarification(recentConversation.latestAssistantMetadata)
    : undefined
  const knowledge = shouldDelegateKnowledgeToTaliaAi
    ? {
      query: message,
      channel: 'chatbot' as const,
      matches: [],
      topMatch: null,
      shouldAnswerDirectly: false,
    }
    : await retrieveTenantKnowledge({
      admin,
      tenantId,
      query: message,
      channel: 'chatbot',
      language: legacyVisitorLanguage ?? tenant.config.language,
    })

  if (legacyVisitorLanguage && knowledge.shouldAnswerDirectly && knowledge.topMatch && knowledge.topMatch.language === legacyVisitorLanguage) {
    const match = knowledge.topMatch
    const directKnowledgeMetadata = {
      source: 'knowledge_retrieval',
      user_message: message,
      response_language: legacyVisitorLanguage,
      retrieval_status: 'direct_match',
      low_confidence: false,
      knowledge_item_id: match.id,
      knowledge_source_id: match.source_id,
      knowledge_source_type: getKnowledgeSourceType(match.metadata),
      knowledge_score: match.score,
      agent_sources: [
        {
          id: match.id,
          source_id: match.source_id,
          source_type: getKnowledgeSourceType(match.metadata),
          score: match.score,
        },
      ],
      ...suggestedQuestionTrace,
    } satisfies Record<string, Json>

    const [saveResult] = await Promise.all([
      saveConversation(admin, {
        tenantId,
        sessionId,
        messages: [
          { role: 'user', content: message, metadata: suggestedQuestionTrace },
          { role: 'assistant', content: match.answer, metadata: directKnowledgeMetadata },
        ],
        metadata: directKnowledgeMetadata,
      }),
      saveConversationTopic(admin, {
        tenantId,
        sessionId,
        topic: match.category ?? undefined,
        userMessage: message,
      }),
    ])
    const assistantMessageId = saveResult.ok
      ? saveResult.messages.find((item) => item.role === 'assistant')?.id
      : undefined

    await recordChatbotUsage(admin, {
      tenantId,
      sessionId,
      message: match.answer,
      phase: 'assistant_message',
      metadata: {
        source: 'knowledge_retrieval',
        knowledge_item_id: match.id,
        knowledge_source_id: match.source_id,
        knowledge_source_type: getKnowledgeSourceType(match.metadata),
      },
    })

    return corsJson({
      reply: match.answer,
      session_id: sessionId,
      assistant_message_id: assistantMessageId,
      source: {
        type: 'knowledge_retrieval',
        id: match.id,
        source_id: match.source_id,
        source_type: getKnowledgeSourceType(match.metadata),
        question: match.question,
        category: match.category,
        score: match.score,
      },
    })
  }

  const response = await runChatAgent({
    n8nWebhookUrl: tenant.config.n8nWebhookUrl,
    tenantId,
    sessionId,
    message,
    pageUrl,
    conversationContext: recentConversation.messages,
    pendingClarification,
    tenant: {
      name: tenant.config.name,
      fallbackLanguage: tenant.config.language,
      responseTone: tenant.config.responseTone,
      systemPrompt: tenant.config.systemPrompt,
      fallbackEmail: tenant.config.fallbackEmail,
      fallbackPhone: tenant.config.fallbackPhone,
      aiSettings: tenant.config.aiSettings,
    },
    relevantKnowledge: shouldDelegateKnowledgeToTaliaAi ? [] : buildRelevantKnowledgeHints(knowledge.matches),
  })

  if (!response.ok) {
    return corsJson({
      error: response.error,
      details: response.details,
      provider: response.provider,
    }, { status: response.status })
  }

  const agentSources = summarizeAgentSources(response.sources)
  const agentMetadata = summarizeAgentMetadata(response.metadata)
  const finalResponseLanguage = response.provider === 'talia-ai'
    ? requireAgentResponseLanguage(agentMetadata)
    : detectChatLanguage(message, tenant.config.language)
  const agentActions = summarizeVerifiedChatActions(response.actions, {
    tenantName: tenant.config.name,
    fallbackPhone: tenant.config.fallbackPhone,
    whatsappEnabled: tenant.config.aiSettings.fallbackWhatsApp,
    purchaseAction: response.metadata?.purchase_action,
  })
  const retrievalTrace = summarizeRetrievalTrace(response.metadata)
  const contactGuard = enforceAllowedContactEmails(response.reply, {
    fallbackEmail: tenant.config.fallbackEmail,
    fallbackContacts: tenant.config.aiSettings.fallbackContacts,
  })
  const safeReply = contactGuard.reply
  const requestedProvider = shouldDelegateKnowledgeToTaliaAi ? 'talia-ai' : 'n8n'
  const retrievalStatus = getRetrievalStatus({
    delegatedToTaliaAi: shouldDelegateKnowledgeToTaliaAi,
    agentSources,
    localKnowledgeMatches: knowledge.matches.length,
    retrievalTrace,
  })
  const lowConfidence = isLowConfidenceTrace(agentSources, agentMetadata)
  const fallbackReason = response.provider !== requestedProvider ? 'primary_provider_failed' : null
  const assistantTraceMetadata = {
    source: response.provider,
    requested_provider: requestedProvider,
    model: response.model ?? null,
    user_message: message,
    page_url: pageUrl ?? null,
    response_language: finalResponseLanguage,
    tenant_fallback_language: tenant.config.language,
    retrieval_status: retrievalStatus,
    low_confidence: lowConfidence,
    fallback_reason: fallbackReason,
    contact_guard: {
      redacted_emails: contactGuard.redactedEmails,
      allowed_emails: contactGuard.allowedEmails,
    },
    agent_sources: agentSources,
    agent_actions: agentActions,
    retrieval: retrievalTrace,
    pending_clarification: pendingClarification ? serializePendingClarification(pendingClarification) : null,
    agent_metadata: agentMetadata,
    ...suggestedQuestionTrace,
  } satisfies Record<string, Json>

  const saveResult = await saveConversation(admin, {
    tenantId,
    sessionId,
    messages: [
      { role: 'user', content: message, metadata: suggestedQuestionTrace },
      { role: 'assistant', content: safeReply, metadata: assistantTraceMetadata },
    ],
    metadata: assistantTraceMetadata,
  })

  if (!saveResult.ok) {
    console.error('[chat] failed to save conversation', {
      tenantId,
      sessionId,
      error: saveResult.error,
      details: saveResult.details,
    })

    return corsJson({
      error: 'Failed to save chat conversation',
      details: saveResult.details,
    }, { status: 500 })
  }

  const assistantMessageId = saveResult.messages.find((item) => item.role === 'assistant')?.id
  const analytics = parseChatAnalytics(agentMetadata.analytics) ?? getFallbackChatAnalytics(message)
  const topicSaveResult = await saveConversationTopic(admin, {
    tenantId,
    sessionId,
    messageId: assistantMessageId,
    topic: analytics.topic,
    intent: analytics.intent,
    confidence: analytics.confidence,
    taxonomyVersion: analytics.taxonomyVersion,
    classificationSource: analytics.source,
    userMessage: message,
    channel: 'web',
  })
  if (!topicSaveResult.ok) {
    console.error('[chat] failed to persist analytics classification', {
      tenantId,
      sessionId,
      assistantMessageId,
      error: topicSaveResult.error,
      details: topicSaveResult.details,
    })
  }

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message: safeReply,
    phase: 'assistant_message',
    inputText: message,
    assistantMessageId,
    usageMeasurement: response.provider === 'talia-ai' ? 'precise' : 'legacy',
    usageComponents: response.usageComponents,
    metadata: {
      source: response.provider,
      model: response.model ?? null,
      knowledge_matches: knowledge.matches.length,
      top_knowledge_score: knowledge.topMatch?.score ?? null,
      response_language: finalResponseLanguage,
      retrieval_status: retrievalStatus,
      low_confidence: lowConfidence,
      fallback_reason: fallbackReason,
      contact_guard: {
        redacted_emails: contactGuard.redactedEmails,
        allowed_emails: contactGuard.allowedEmails,
      },
      agent_sources: agentSources,
      agent_actions: agentActions,
      retrieval: retrievalTrace,
      pending_clarification: pendingClarification ? serializePendingClarification(pendingClarification) : null,
      agent_metadata: agentMetadata,
    },
  })

  return corsJson({
    reply: safeReply,
    actions: agentActions,
    session_id: sessionId,
    assistant_message_id: assistantMessageId,
    source: {
      type: 'agent_runtime',
      provider: response.provider,
      model: response.model,
      sources: agentSources,
      metadata: agentMetadata,
    },
  })
}

function getSuggestedQuestionTrace(
  selection: VisibleSuggestedQuestion | null,
): Record<string, Json> {
  if (!selection) return {}

  return {
    suggested_question: {
      id: selection.id,
      position: selection.position,
      language: selection.language,
      source: selection.source,
      matched_target: selection.matchedTarget ? {
        type: selection.matchedTarget.type,
        value: selection.matchedTarget.value,
      } : null,
    },
  }
}

function normalizePageUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    url.hash = ''
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith('talia_')) url.searchParams.delete(key)
    }
    url.search = url.searchParams.toString()
    return url.toString()
  } catch {
    return undefined
  }
}

function enforceAllowedContactEmails(
  reply: string,
  config: { fallbackEmail: string | null; fallbackContacts: boolean }
) {
  const allowedEmails = config.fallbackContacts && config.fallbackEmail
    ? [config.fallbackEmail.trim().toLowerCase()]
    : []
  const fallback = allowedEmails[0]
  const redactedEmails = new Set<string>()

  const safeReply = reply.replace(EMAIL_PATTERN, (match) => {
    const normalized = match.trim().toLowerCase()
    if (allowedEmails.includes(normalized)) return match
    redactedEmails.add(normalized)
    return fallback ?? 'el contacto oficial configurado'
  })

  return {
    reply: safeReply,
    allowedEmails,
    redactedEmails: Array.from(redactedEmails),
  }
}

function getKnowledgeSourceType(metadata: Record<string, unknown> | null) {
  const sourceType = metadata?.source_type
  return typeof sourceType === 'string' ? sourceType : 'knowledge_item'
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

function buildLimitFallbackMessage(
  config: { name: string; fallbackEmail: string | null; fallbackPhone: string | null },
  language: string,
) {
  const copy = getLimitFallbackCopy(language)
  const contactParts = [
    config.fallbackEmail ? `${copy.email} ${config.fallbackEmail}` : null,
    config.fallbackPhone ? `${copy.phone} ${config.fallbackPhone}` : null,
  ].filter((part): part is string => Boolean(part))

  if (contactParts.length === 0) {
    return `${copy.base} ${copy.retry}`
  }

  return `${copy.base} ${copy.contact} ${config.name} ${copy.by} ${contactParts.join(` ${copy.or} `)}.`
}

function getLimitFallbackCopy(language: string) {
  if (language === 'ca') {
    return {
      base: 'Ara mateix no puc respondre la teva consulta. Disculpa les molèsties.',
      retry: 'Si us plau, torna-ho a provar més tard.',
      contact: 'Pots contactar amb',
      by: 'per',
      or: 'o',
      email: 'correu',
      phone: 'telèfon',
    }
  }

  if (language === 'en') {
    return {
      base: 'I cannot answer your question right now. Sorry for the inconvenience.',
      retry: 'Please try again later.',
      contact: 'You can contact',
      by: 'by',
      or: 'or',
      email: 'email',
      phone: 'phone',
    }
  }

  return {
    base: 'Ahora mismo no puedo responder tu consulta. Disculpa las molestias.',
    retry: 'Por favor, vuelve a intentarlo más tarde.',
    contact: 'Puedes contactar con',
    by: 'por',
    or: 'o',
    email: 'correo',
    phone: 'teléfono',
  }
}

export function OPTIONS() {
  return corsNoContent()
}

async function recordChatbotUsage(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    tenantId: string
    sessionId: string
    message: string
    phase: 'user_message' | 'assistant_message'
    inputText?: string
    assistantMessageId?: string
    usageMeasurement?: 'precise' | 'legacy'
    usageComponents?: ChatAiUsageComponent[]
    metadata?: Record<string, Json | undefined>
  },
) {
  if (input.phase === 'user_message') {
    await Promise.all([
      recordUsageEvent(admin, {
        tenantId: input.tenantId,
        moduleKey: 'chatbot',
        channel: 'chatbot',
        eventType: 'conversation_started',
        unit: 'conversation',
        idempotencyKey: `chatbot:${input.tenantId}:${input.sessionId}:conversation_started`,
        metadata: { session_id: input.sessionId },
      }),
      recordUsageEvent(admin, {
        tenantId: input.tenantId,
        moduleKey: 'chatbot',
        channel: 'chatbot',
        eventType: 'message',
        unit: 'message',
        inputTokens: estimateTokenCount(input.message),
        metadata: {
          session_id: input.sessionId,
          role: 'user',
          ...(input.metadata ?? {}),
        },
      }),
    ])

    return
  }

  const components = input.usageComponents ?? []
  const preciseMeasurement = input.usageMeasurement === 'precise'
  const usageCorrelationId = input.assistantMessageId ?? crypto.randomUUID()
  const measuredTotals = components.reduce((total, component) => ({
    requestCount: total.requestCount + component.request_count,
    inputTokens: total.inputTokens + component.input_tokens,
    outputTokens: total.outputTokens + component.output_tokens,
  }), { requestCount: 0, inputTokens: 0, outputTokens: 0 })

  await recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'chatbot',
    channel: 'chatbot',
    eventType: 'message',
    unit: 'message',
    ...(input.assistantMessageId
      ? { idempotencyKey: `chatbot:${input.tenantId}:${input.assistantMessageId}:assistant_message` }
      : {}),
    metadata: {
      session_id: input.sessionId,
      role: 'assistant',
      ...(input.metadata ?? {}),
    },
  })

  if (preciseMeasurement) {
    if (!components.length) return

    const aiCall = await recordUsageEvent(admin, {
      tenantId: input.tenantId,
      moduleKey: 'chatbot',
      channel: 'chatbot',
      eventType: 'ai_call',
      quantity: measuredTotals.requestCount,
      unit: 'call',
      inputTokens: measuredTotals.inputTokens,
      outputTokens: measuredTotals.outputTokens,
      idempotencyKey: `chatbot:${input.tenantId}:${usageCorrelationId}:ai_call`,
      metadata: {
        session_id: input.sessionId,
        accuracy: 'measured',
        component_count: components.length,
        ...(input.metadata ?? {}),
      },
    })

    if (!aiCall.ok || !aiCall.eventId) return

    const preciseUsage = await recordMeasuredAiUsage(admin, {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      usageEventId: aiCall.eventId,
      idempotencyPrefix: `chatbot:${input.tenantId}:${usageCorrelationId}:component`,
      components,
      metadata: {
        assistant_message_id: input.assistantMessageId ?? null,
      },
    })

    if (!preciseUsage.ok) {
      console.error('[chat] failed to persist precise AI usage', {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        error: preciseUsage.error,
      })
    }
    return
  }

  if (!input.inputText) return
  const inputTokens = estimateTokenCount(input.inputText)
  const outputTokens = estimateTokenCount(input.message)
  await recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'chatbot',
    channel: 'chatbot',
    eventType: 'ai_call',
    unit: 'call',
    inputTokens,
    outputTokens,
    costEstimateCents: estimateOpenAiTextCostCents(inputTokens, outputTokens, 'gpt-4o'),
    metadata: {
      session_id: input.sessionId,
      model: 'gpt-4o',
      accuracy: 'estimated_legacy',
      ...(input.metadata ?? {}),
    },
  })
}

function summarizeAgentSources(sources: unknown[] | undefined): AgentSourceSummary[] {
  if (!Array.isArray(sources)) return []

  return sources
    .map((source) => {
      if (!isRecord(source)) return null
      const id = typeof source.id === 'string' ? source.id : null
      const sourceId = typeof source.source_id === 'string' ? source.source_id : null
      const sourceType = typeof source.source_type === 'string' ? source.source_type : null
      const score = typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : null
      if (!id && !sourceId && !sourceType) return null
      return {
        id,
        source_id: sourceId,
        source_type: sourceType,
        score,
      } satisfies AgentSourceSummary
    })
    .filter((source): source is AgentSourceSummary => Boolean(source))
    .slice(0, 8)
}

function summarizeAgentMetadata(metadata: Record<string, unknown> | undefined): Record<string, Json> {
  if (!metadata) return {}

  const allowedKeys = ['intent', 'confidence', 'response_language', 'action'] as const
  const result: Record<string, Json> = {}
  for (const key of allowedKeys) {
    const value = metadata[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[key] = value
    }
  }
  const clarification = summarizeClarification(metadata.clarification)
  if (clarification) result.clarification = clarification

  const clarificationResolution = summarizeClarificationResolution(metadata.clarification_resolution)
  if (clarificationResolution) result.clarification_resolution = clarificationResolution

  const contextAssembly = summarizeContextAssembly(metadata.context_assembly)
  if (contextAssembly) result.context_assembly = contextAssembly

  const fallback = summarizeFallback(metadata.fallback)
  if (fallback) result.fallback = fallback

  const languageAgent = summarizeLanguageAgent(metadata.language_agent)
  if (languageAgent) result.language_agent = languageAgent

  const conversation = summarizeConversation(metadata.conversation)
  if (conversation) result.conversation = conversation

  const locationAction = summarizeLocationAction(metadata.location_action)
  if (locationAction) result.location_action = locationAction

  const purchaseAction = summarizePurchaseAction(metadata.purchase_action)
  if (purchaseAction) result.purchase_action = purchaseAction

  const analytics = parseChatAnalytics(metadata.analytics)
  if (analytics) {
    result.analytics = {
      topic: analytics.topic,
      intent: analytics.intent,
      confidence: analytics.confidence,
      taxonomy_version: analytics.taxonomyVersion,
      source: analytics.source,
    }
  }

  return result
}

function summarizeLocationAction(value: unknown): Json | null {
  if (!isRecord(value)) return null
  const status = value.status === 'verified'
    || value.status === 'rejected'
    || value.status === 'not_requested'
    ? value.status
    : null
  const reason = typeof value.reason === 'string' ? value.reason.trim().slice(0, 120) : ''
  if (!status || !reason) return null

  return {
    status,
    reason,
    supported_source_id: typeof value.supported_source_id === 'string'
      ? value.supported_source_id.slice(0, 200)
      : null,
  }
}

function summarizePurchaseAction(value: unknown): Json | null {
  if (!isRecord(value)) return null
  const status = value.status === 'verified'
    || value.status === 'needs_clarification'
    || value.status === 'not_requested'
    || value.status === 'unavailable'
    || value.status === 'rejected'
    ? value.status
    : null
  const reason = typeof value.reason === 'string' ? value.reason.trim().slice(0, 120) : ''
  if (!status || !reason) return null

  return {
    status,
    reason,
    item_name: typeof value.item_name === 'string'
      ? value.item_name.trim().slice(0, 200)
      : null,
    supported_source_id: typeof value.supported_source_id === 'string'
      ? value.supported_source_id.slice(0, 200)
      : null,
  }
}

function summarizeConversation(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const contextMessageCount = typeof value.context_message_count === 'number'
    && Number.isFinite(value.context_message_count)
    ? Math.max(0, Math.trunc(value.context_message_count))
    : null
  const semanticQuery = typeof value.semantic_query === 'string'
    ? value.semantic_query.trim().slice(0, 2_000)
    : ''
  if (contextMessageCount === null || !semanticQuery) return null

  return {
    context_message_count: contextMessageCount,
    follow_up: value.follow_up === true,
    semantic_query: semanticQuery,
  }
}

function summarizeLanguageAgent(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const mode = value.mode === 'deterministic' || value.mode === 'llm' ? value.mode : null
  const fallbackLanguage = typeof value.fallback_language === 'string' ? value.fallback_language : null
  if (!mode || !fallbackLanguage) return null

  return {
    requested_language: typeof value.requested_language === 'string' ? value.requested_language : null,
    fallback_language: fallbackLanguage,
    confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? value.confidence
      : null,
    mode,
    query_expansions: Array.isArray(value.query_expansions)
      ? value.query_expansions.filter((item): item is string => typeof item === 'string').slice(0, 36)
      : [],
  }
}

function getAgentResponseLanguage(metadata: Record<string, Json>) {
  const responseLanguage = metadata.response_language
  return typeof responseLanguage === 'string' && responseLanguage.trim()
    ? responseLanguage
    : null
}

function requireAgentResponseLanguage(metadata: Record<string, Json>) {
  const responseLanguage = getAgentResponseLanguage(metadata)
  if (!responseLanguage) {
    throw new Error('talia-ai response language contract was not preserved by the gateway')
  }
  return responseLanguage
}

function summarizeFallback(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const reason = typeof value.reason === 'string' ? value.reason : null
  const strategy = typeof value.strategy === 'string' ? value.strategy : null
  if (!reason || !strategy) return null

  return {
    reason,
    strategy,
    language: typeof value.language === 'string' ? value.language : null,
    channels: Array.isArray(value.channels)
      ? value.channels.filter((channel): channel is string => typeof channel === 'string').slice(0, 5)
      : [],
    template_source: typeof value.template_source === 'string' ? value.template_source : null,
    whatsapp_link_used: value.whatsapp_link_used === true,
    trigger: typeof value.trigger === 'string' ? value.trigger : null,
  }
}

function summarizeContextAssembly(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const mode = typeof value.mode === 'string' ? value.mode : null
  if (!mode) return null

  const rejected = Array.isArray(value.rejected)
    ? value.rejected
      .map(summarizeContextAssemblyRejection)
      .filter((item): item is Json => Boolean(item))
      .slice(0, 8)
    : []

  return {
    mode,
    focus: typeof value.focus === 'string' ? value.focus : null,
    reason: typeof value.reason === 'string' ? value.reason : null,
    confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? value.confidence : null,
    selected_count: typeof value.selected_count === 'number' && Number.isFinite(value.selected_count) ? value.selected_count : null,
    rejected_count: typeof value.rejected_count === 'number' && Number.isFinite(value.rejected_count) ? value.rejected_count : rejected.length,
    rejected,
  }
}

function summarizeContextAssemblyRejection(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' ? value.id : null
  const score = typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : null
  const reason = typeof value.reason === 'string' ? value.reason : null
  if (!id && !reason) return null

  return {
    id,
    score,
    reason,
  }
}

function summarizeClarification(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const intent = typeof value.intent === 'string' ? value.intent : null
  const reason = typeof value.reason === 'string' ? value.reason : null
  const options = Array.isArray(value.options)
    ? value.options.filter((option): option is string => typeof option === 'string').slice(0, 8)
    : []
  const optionKeys = Array.isArray(value.option_keys)
    ? value.option_keys.filter((option): option is string => typeof option === 'string').slice(0, 8)
    : []

  if (!intent || options.length === 0) return null
  return {
    intent,
    reason,
    options,
    option_keys: optionKeys,
  }
}

function summarizeClarificationResolution(value: unknown): Json | null {
  if (!isRecord(value)) return null

  const status = typeof value.status === 'string' ? value.status : null
  const intent = typeof value.intent === 'string' ? value.intent : null
  if (!status || !intent) return null

  return {
    status,
    intent,
    reason: typeof value.reason === 'string' ? value.reason : null,
    selected_option_key: typeof value.selected_option_key === 'string' ? value.selected_option_key : null,
    selected_option: typeof value.selected_option === 'string' ? value.selected_option : null,
    user_message: typeof value.user_message === 'string' ? truncateForMetadata(value.user_message, 200) : null,
    rewritten_query: typeof value.rewritten_query === 'string' ? truncateForMetadata(value.rewritten_query, 360) : null,
  }
}

function extractPendingClarification(metadata: Json | undefined): ChatAgentPendingClarification | undefined {
  if (!isRecord(metadata)) return undefined
  const agentMetadata = isRecord(metadata.agent_metadata) ? metadata.agent_metadata : metadata
  if (agentMetadata.action !== 'clarification_requested') return undefined

  const clarification = isRecord(agentMetadata.clarification) ? agentMetadata.clarification : null
  if (!clarification || !isClarificationIntent(clarification.intent)) return undefined

  const options = Array.isArray(clarification.options)
    ? clarification.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, 8)
    : []
  if (options.length === 0) return undefined

  const optionKeys = Array.isArray(clarification.option_keys)
    ? clarification.option_keys.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, options.length)
    : undefined

  return {
    intent: clarification.intent,
    ...(typeof clarification.reason === 'string' ? { reason: clarification.reason } : {}),
    options,
    ...(optionKeys?.length ? { optionKeys } : {}),
  }
}

function serializePendingClarification(value: ChatAgentPendingClarification): Json {
  return {
    intent: value.intent,
    reason: value.reason ?? null,
    options: value.options,
    option_keys: value.optionKeys ?? [],
  }
}

function isClarificationIntent(value: unknown): value is ChatAgentPendingClarification['intent'] {
  return value === 'pricing' || value === 'schedule' || value === 'program'
}

function summarizeRetrievalTrace(metadata: Record<string, unknown> | undefined): RetrievalTrace | null {
  if (!metadata || !isRecord(metadata.retrieval)) return null

  const retrieval = metadata.retrieval
  const chunks = Array.isArray(retrieval.chunks)
    ? retrieval.chunks
      .map((chunk, index) => summarizeRetrievalChunk(chunk, index))
      .filter((chunk): chunk is RetrievalTraceChunk => Boolean(chunk))
      .slice(0, 8)
    : []

  return {
    status: typeof retrieval.status === 'string' ? retrieval.status : null,
    query_language: typeof retrieval.query_language === 'string' ? retrieval.query_language : null,
    top_score: typeof retrieval.top_score === 'number' && Number.isFinite(retrieval.top_score) ? retrieval.top_score : null,
    chunks,
  }
}

function summarizeRetrievalChunk(chunk: unknown, fallbackIndex: number): RetrievalTraceChunk | null {
  if (!isRecord(chunk)) return null

  const id = typeof chunk.id === 'string' ? chunk.id : null
  const sourceId = typeof chunk.source_id === 'string' ? chunk.source_id : null
  const sourceType = typeof chunk.source_type === 'string' ? chunk.source_type : null
  const score = typeof chunk.score === 'number' && Number.isFinite(chunk.score) ? chunk.score : null
  const rank = typeof chunk.rank === 'number' && Number.isFinite(chunk.rank) ? chunk.rank : fallbackIndex + 1
  const used = typeof chunk.used === 'boolean' ? chunk.used : null
  const language = typeof chunk.language === 'string' ? chunk.language : null
  const preview = typeof chunk.preview === 'string' ? truncateForMetadata(chunk.preview, 360) : null

  if (!id && !sourceId && !sourceType && !preview) return null

  return {
    id,
    source_id: sourceId,
    source_type: sourceType,
    score,
    rank,
    used,
    language,
    preview,
  }
}

function getRetrievalStatus({
  delegatedToTaliaAi,
  agentSources,
  localKnowledgeMatches,
  retrievalTrace,
}: {
  delegatedToTaliaAi: boolean
  agentSources: AgentSourceSummary[]
  localKnowledgeMatches: number
  retrievalTrace: RetrievalTrace | null
}) {
  if (retrievalTrace?.status) return retrievalTrace.status
  if ((retrievalTrace?.chunks.length ?? 0) > 0) return 'sources_used'
  if (agentSources.length > 0) return 'sources_used'
  if (delegatedToTaliaAi) return 'delegated_no_sources'
  if (localKnowledgeMatches > 0) return 'local_matches_not_used'
  return 'no_sources'
}

function isLowConfidenceTrace(agentSources: AgentSourceSummary[], agentMetadata: Record<string, Json>) {
  const confidence = agentMetadata.confidence
  if (typeof confidence === 'number') return confidence < 0.35
  if (typeof confidence === 'string') {
    const normalized = confidence.toLowerCase()
    if (['low', 'baja', 'baix'].includes(normalized)) return true
  }

  const scores = agentSources
    .map((source) => source.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))

  if (!scores.length) return false
  return Math.max(...scores) < 0.25
}

function truncateForMetadata(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
