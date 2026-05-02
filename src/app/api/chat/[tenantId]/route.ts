import { saveConversation } from '@/lib/chat/service'
import { sendChatMessageToN8n } from '@/lib/chat/n8n'
import { saveConversationTopic } from '@/lib/analytics/topics'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { searchTenantKnowledge, shouldAnswerFromKnowledge } from '@/lib/knowledge/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'

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

  return corsJson({
    reply: response.reply,
    session_id: sessionId,
  })
}

export function OPTIONS() {
  return corsNoContent()
}
