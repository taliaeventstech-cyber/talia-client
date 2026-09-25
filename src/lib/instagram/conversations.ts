import type { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

type AdminClient = ReturnType<typeof createAdminClient>

const nullableString = z.string().nullable()
const statusSchema = z.enum(['open', 'pending', 'handoff', 'resolved', 'blocked'])

const historyItemSchema = z.object({
  id: z.uuid(),
  status: statusSchema,
  contact_masked: z.string(),
  last_message_at: nullableString,
  created_at: z.string(),
  handoff_reason: nullableString,
  message_count: z.number().int().nonnegative(),
  latest_message: nullableString,
  latest_direction: z.enum(['inbound', 'outbound']).nullable(),
})

const historySchema = z.object({
  items: z.array(historyItemSchema),
  count: z.number().int().nonnegative(),
})

const messageSchema = z.object({
  id: z.uuid(),
  direction: z.enum(['inbound', 'outbound']),
  message_type: z.string(),
  body_text: nullableString,
  created_at: z.string(),
  delivery_status: nullableString,
  processing_status: z.string(),
  is_operator_reply: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
})

const detailSchema = z.object({
  id: z.uuid(),
  status: statusSchema,
  operator_mode: z.boolean(),
  contact_masked: z.string(),
  handoff_reason: nullableString,
  created_at: z.string(),
  last_message_at: nullableString,
  assigned_profile_id: z.uuid().nullable(),
  assigned_name: nullableString,
  assigned_email: nullableString,
  human_agent_eligible_until: nullableString,
  human_agent_window_expired: z.boolean(),
  messages: z.array(messageSchema),
})

export type InstagramConversationHistoryItem = z.infer<typeof historyItemSchema>
export type InstagramConversationDetail = z.infer<typeof detailSchema>

export async function getInstagramConversationHistory(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string; limit?: number },
) {
  const result = await admin.rpc('get_instagram_conversation_history', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_limit: input.limit ?? 100,
  })
  if (result.error) throw new Error(`instagram_conversation_history_failed:${result.error.message}`)

  const parsed = historySchema.safeParse(result.data)
  if (!parsed.success) throw new Error('instagram_conversation_history_invalid')
  return parsed.data
}

export async function getInstagramConversationDetail(
  admin: AdminClient,
  input: { tenantId: string; conversationId: string; actorUserId: string },
) {
  const result = await admin.rpc('get_instagram_conversation_detail', {
    p_theatre_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_actor_user_id: input.actorUserId,
  })
  if (result.error) throw new Error(`instagram_conversation_detail_failed:${result.error.message}`)
  if (result.data === null) return null

  const parsed = detailSchema.safeParse(result.data)
  if (!parsed.success) throw new Error('instagram_conversation_detail_invalid')
  return parsed.data
}
