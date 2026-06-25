import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type IncomingChatMessage = {
  role: 'user' | 'assistant'
  content: string
  metadata?: Json
}

export type SaveConversationInput = {
  tenantId: string
  sessionId: string
  messages: IncomingChatMessage[]
  metadata?: Json
}

export async function saveConversation(admin: AdminClient, input: SaveConversationInput) {
  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .upsert(
      {
        theatre_id: input.tenantId,
        session_id: input.sessionId,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
      { onConflict: 'session_id' }
    )
    .select('id')
    .single()

  if (conversationError || !conversation) {
    return {
      ok: false as const,
      error: 'Failed to upsert conversation',
      details: conversationError?.message,
    }
  }

  const messages = input.messages.map((message) => ({
    conversation_id: conversation.id,
    theatre_id: input.tenantId,
    role: message.role,
    content: message.content,
    metadata: message.metadata ?? {},
  }))

  const { error: messagesError } = await admin.from('messages').insert(messages)

  if (messagesError) {
    return {
      ok: false as const,
      error: 'Failed to insert messages',
      details: messagesError.message,
    }
  }

  return {
    ok: true as const,
    conversationId: conversation.id,
  }
}

export async function getLatestUserMessage(admin: AdminClient, tenantId: string, sessionId: string) {
  const { data: conversation } = await admin
    .from('conversations')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!conversation) return undefined

  const { data: message } = await admin
    .from('messages')
    .select('content')
    .eq('theatre_id', tenantId)
    .eq('conversation_id', conversation.id)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return message?.content
}
