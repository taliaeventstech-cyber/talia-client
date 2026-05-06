'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { revalidatePath } from 'next/cache'

export async function deleteConversation(
  tenantId: string,
  conversationId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireTenantPermission(tenantId, 'delete_conversations', 'chatbot')

  const admin = createAdminClient()

  // Fetch session_id to clean up conversation_topics
  const { data: conversation } = await admin
    .from('conversations')
    .select('session_id')
    .eq('id', conversationId)
    .eq('theatre_id', tenantId)
    .single()

  if (!conversation) return { ok: false, error: 'Conversación no encontrada.' }

  // Delete associated topics
  await admin
    .from('conversation_topics')
    .delete()
    .eq('theatre_id', tenantId)
    .eq('session_id', conversation.session_id)

  // Delete conversation (messages cascade via DB constraint)
  const { error } = await admin
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('theatre_id', tenantId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${tenantId}/conversations`)
  return { ok: true }
}
