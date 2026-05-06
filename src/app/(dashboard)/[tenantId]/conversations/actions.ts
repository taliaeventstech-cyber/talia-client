'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteConversation(
  tenantId: string,
  conversationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, error: 'Sin permisos.' }

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
