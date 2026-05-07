import { saveConversation } from '@/lib/chat/service'
import { sendChatMessageToN8n } from '@/lib/chat/n8n'
import { saveConversationTopic } from '@/lib/analytics/topics'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { searchTenantKnowledge, shouldAnswerFromKnowledge } from '@/lib/knowledge/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
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

    return corsJson({
      error: 'Chatbot usage limit reached for this tenant',
      code: 'usage_limit_reached',
    }, { status: 402 })
  }

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message,
    phase: 'user_message',
  })

  const knowledgeMatches = await searchTenantKnowledge(admin, tenantId, message)
  if (shouldAnswerFromKnowledge(knowledgeMatches)) {
    const match = knowledgeMatches[0]

    await Promise.all([
      saveConversation(admin, {
        tenantId,
        sessionId,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: match.answer },
        ],
        metadata: {
          source: 'knowledge_base',
          knowledge_item_id: match.id,
          knowledge_score: match.score,
        },
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
        source: 'knowledge_base',
        knowledge_item_id: match.id,
      },
    })

    return corsJson({
      reply: match.answer,
      session_id: sessionId,
      source: {
        type: 'knowledge_base',
        id: match.id,
        question: match.question,
        category: match.category,
        score: match.score,
      },
    })
  }

  if (!tenant.config.n8nWebhookUrl) {
    return corsJson({ error: 'Chat is not configured for this tenant' }, { status: 503 })
  }

  const response = await sendChatMessageToN8n({
    webhookUrl: tenant.config.n8nWebhookUrl,
    tenantId,
    sessionId,
    message,
  })

  if (!response.ok) {
    return corsJson({ error: response.error, details: response.details }, { status: 502 })
  }

  await recordChatbotUsage(admin, {
    tenantId,
    sessionId,
    message: response.reply,
    phase: 'assistant_message',
    inputText: message,
    metadata: {
      source: 'n8n',
    },
  })

  return corsJson({
    reply: response.reply,
    session_id: sessionId,
  })
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
    metadata?: Record<string, string | number | boolean | null>
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
