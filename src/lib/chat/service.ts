import type { createAdminClient } from '@/lib/supabase/admin'
import {
  boundConversationContext,
  CONVERSATION_CONTEXT_LIMITS,
  type ChatConversationContextMessage,
  type ConversationContextRow,
} from '@/lib/chat/conversation-context'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type IncomingChatMessage = {
  role: 'user' | 'assistant'
  content: string
  metadata?: Json
}

export type SavedChatMessage = {
  id: string
  role: 'user' | 'assistant'
}

export type SaveConversationInput = {
  tenantId: string
  sessionId: string
  messages: IncomingChatMessage[]
  metadata?: Json
}

type ConversationStateRow = ConversationContextRow & {
  metadata?: unknown
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

  const { data: savedMessages, error: messagesError } = await admin
    .from('messages')
    .insert(messages)
    .select('id, role')

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
    messages: (savedMessages ?? []) as SavedChatMessage[],
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

export async function getLatestAssistantMessageMetadata(admin: AdminClient, tenantId: string, sessionId: string) {
  const { data: conversation } = await admin
    .from('conversations')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!conversation) return undefined

  const { data: message } = await admin
    .from('messages')
    .select('metadata')
    .eq('theatre_id', tenantId)
    .eq('conversation_id', conversation.id)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return message?.metadata
}

export async function getRecentConversationState(admin: AdminClient, tenantId: string, sessionId: string) {
  const { data: conversation } = await admin
    .from('conversations')
    .select('id')
    .eq('theatre_id', tenantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!conversation) {
    return {
      messages: [] as ChatConversationContextMessage[],
      latestAssistantMetadata: undefined as Json | undefined,
    }
  }

  const { data } = await admin
    .from('messages')
    .select('role, content, metadata')
    .eq('theatre_id', tenantId)
    .eq('conversation_id', conversation.id)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(CONVERSATION_CONTEXT_LIMITS.maxMessages)

  const rows = (data ?? []) as ConversationStateRow[]
  const latestAssistant = rows.find((row) => row.role === 'assistant')

  return {
    messages: boundConversationContext(rows),
    latestAssistantMetadata: isJsonValue(latestAssistant?.metadata)
      ? latestAssistant.metadata
      : undefined,
  }
}

function isJsonValue(value: unknown): value is Json {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || Array.isArray(value)
    || (typeof value === 'object' && value !== null)
}
