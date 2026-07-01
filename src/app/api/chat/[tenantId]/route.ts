import { saveConversation } from '@/lib/chat/service'
import { saveConversationTopic } from '@/lib/analytics/topics'
import { isTaliaAiPrimaryProvider, runChatAgent } from '@/lib/agent-runtime/chat'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { buildRelevantKnowledgeHints, retrieveTenantKnowledge } from '@/lib/knowledge/retrieval'
import { detectChatLanguage } from '@/lib/chat/language'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import type { Json } from '@/types/database.types'
import {
  checkTenantLimit,
  estimateOpenAiTextCostCents,
  estimateTokenCount,
  recordUsageEvent,
} from '@/lib/usage/service'

type ChatPayload = {
  session_id?: string
  sessionId?: string
  message?: string
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

  if (!sessionId || !message) {
    return corsJson({ error: 'session_id and message are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const tenant = await getTenantChatConfig(admin, tenantId)

  if (!tenant.ok) {
    return corsJson({ error: tenant.error }, { status: 404 })
  }

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
    const fallbackReply = buildLimitFallbackMessage(tenant.config)
    const fallbackMetadata = {
      source: 'usage_limit_fallback',
      user_message: message,
      response_language: detectChatLanguage(message, tenant.config.language),
      retrieval_status: 'not_run',
      fallback_reason: 'usage_limit_reached',
      limit: limit.limit,
      current: limit.current,
    } satisfies Record<string, Json>

    await Promise.all([
      saveConversation(admin, {
        tenantId,
        sessionId,
        messages: [
          { role: 'user', content: message },
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

    return corsJson({
      reply: fallbackReply,
      session_id: sessionId,
      limited: true,
      source: { type: 'usage_limit_fallback' },
    })
  }

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message,
    phase: 'user_message',
  })

  const responseLanguage = detectChatLanguage(message, tenant.config.language)
  const shouldDelegateKnowledgeToTaliaAi = isTaliaAiPrimaryProvider()
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
      language: responseLanguage,
    })

  if (knowledge.shouldAnswerDirectly && knowledge.topMatch && knowledge.topMatch.language === responseLanguage) {
    const match = knowledge.topMatch
    const directKnowledgeMetadata = {
      source: 'knowledge_retrieval',
      user_message: message,
      response_language: responseLanguage,
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
    } satisfies Record<string, Json>

    await Promise.all([
      saveConversation(admin, {
        tenantId,
        sessionId,
        messages: [
          { role: 'user', content: message },
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
    tenant: {
      name: tenant.config.name,
      language: responseLanguage,
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
  const retrievalTrace = summarizeRetrievalTrace(response.metadata)
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
    response_language: responseLanguage,
    retrieval_status: retrievalStatus,
    low_confidence: lowConfidence,
    fallback_reason: fallbackReason,
    agent_sources: agentSources,
    retrieval: retrievalTrace,
    agent_metadata: agentMetadata,
  } satisfies Record<string, Json>

  const saveResult = await saveConversation(admin, {
    tenantId,
    sessionId,
    messages: [
      { role: 'user', content: message },
      { role: 'assistant', content: response.reply, metadata: assistantTraceMetadata },
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

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message: response.reply,
    phase: 'assistant_message',
    inputText: message,
    metadata: {
      source: response.provider,
      model: response.model ?? null,
      knowledge_matches: knowledge.matches.length,
      top_knowledge_score: knowledge.topMatch?.score ?? null,
      response_language: responseLanguage,
      retrieval_status: retrievalStatus,
      low_confidence: lowConfidence,
      fallback_reason: fallbackReason,
      agent_sources: agentSources,
      retrieval: retrievalTrace,
      agent_metadata: agentMetadata,
    },
  })

  return corsJson({
    reply: response.reply,
    session_id: sessionId,
    source: {
      type: 'agent_runtime',
      provider: response.provider,
      model: response.model,
      sources: agentSources,
      metadata: agentMetadata,
    },
  })
}

function getKnowledgeSourceType(metadata: Record<string, unknown> | null) {
  const sourceType = metadata?.source_type
  return typeof sourceType === 'string' ? sourceType : 'knowledge_item'
}

function buildLimitFallbackMessage(config: { name: string; fallbackEmail: string | null; fallbackPhone: string | null }) {
  const contactParts = [
    config.fallbackEmail ? `correu ${config.fallbackEmail}` : null,
    config.fallbackPhone ? `telèfon ${config.fallbackPhone}` : null,
  ].filter((part): part is string => Boolean(part))

  const base = `Ara mateix no puc respondre la teva consulta. Disculpa les molèsties.`
  if (contactParts.length === 0) {
    return `${base} Si us plau, torna-ho a provar més tard.`
  }

  return `${base} Pots contactar amb ${config.name} per ${contactParts.join(' o ')}.`
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
        },
      }),
    ])

    return
  }

  const inputTokens = estimateTokenCount(input.inputText ?? '')
  const outputTokens = estimateTokenCount(input.message)
  const costEstimateCents = input.inputText
    ? estimateOpenAiTextCostCents(inputTokens, outputTokens, 'gpt-4o')
    : 0

  await Promise.all([
    recordUsageEvent(admin, {
      tenantId: input.tenantId,
      moduleKey: 'chatbot',
      channel: 'chatbot',
      eventType: 'message',
      unit: 'message',
      outputTokens,
      metadata: {
        session_id: input.sessionId,
        role: 'assistant',
        ...(input.metadata ?? {}),
      },
    }),
    ...(input.inputText
      ? [
        recordUsageEvent(admin, {
          tenantId: input.tenantId,
          moduleKey: 'chatbot',
          channel: 'chatbot',
          eventType: 'ai_call',
          unit: 'call',
          inputTokens,
          outputTokens,
          costEstimateCents,
          metadata: {
            session_id: input.sessionId,
            model: 'gpt-4o',
            ...(input.metadata ?? {}),
          },
        }),
      ]
      : []),
  ])
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

  const allowedKeys = ['intent', 'confidence', 'response_language'] as const
  const result: Record<string, Json> = {}
  for (const key of allowedKeys) {
    const value = metadata[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[key] = value
    }
  }
  return result
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
