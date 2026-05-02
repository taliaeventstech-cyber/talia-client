export type KnowledgeFaqHint = {
  question: string
  answer: string
  category: string | null
  priority: number
}

export type N8nChatInput = {
  webhookUrl: string
  tenantId: string
  sessionId: string
  message: string
  relevantKnowledge?: KnowledgeFaqHint[]
}

export async function sendChatMessageToN8n(input: N8nChatInput) {
  const response = await fetch(input.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      sessionId: input.sessionId,
      session_id: input.sessionId,
      chatInput: input.message,
      message: input.message,
      ...(input.relevantKnowledge?.length
        ? { relevant_knowledge: input.relevantKnowledge }
        : {}),
    }),
  })

  const text = await response.text()

  if (!response.ok) {
    return {
      ok: false as const,
      error: `n8n responded with ${response.status}`,
      details: text,
    }
  }

  return {
    ok: true as const,
    reply: parseN8nReply(text),
    raw: text,
  }
}

function parseN8nReply(text: string) {
  if (!text) return ''

  try {
    const parsed = JSON.parse(text)
    return extractReply(parsed) ?? text
  } catch {
    return text
  }
}

function extractReply(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const reply = extractReply(item)
      if (reply) return reply
    }
    return null
  }
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const direct = record.reply ?? record.output ?? record.text ?? record.response ?? record.answer ?? record.message
  if (typeof direct === 'string') return direct

  if (direct && typeof direct === 'object') {
    const nested = direct as Record<string, unknown>
    if (typeof nested.content === 'string') return nested.content
  }

  return null
}
