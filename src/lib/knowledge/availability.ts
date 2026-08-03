import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function hasUsableTenantKnowledge(admin: AdminClient, tenantId: string) {
  const [items, chunks] = await Promise.all([
    admin
      .from('knowledge_items')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('active', true),
    admin
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .eq('embedding_status', 'ready'),
  ])

  if (items.error || chunks.error) {
    console.error('[knowledge-availability] Could not determine chatbot readiness', {
      tenantId,
      itemsError: items.error?.message,
      chunksError: chunks.error?.message,
    })
    return false
  }

  return (items.count ?? 0) > 0 || (chunks.count ?? 0) > 0
}

export function shouldBlockChatbotActivation({
  currentlyEnabled,
  requestedEnabled,
  hasUsableKnowledge,
}: {
  currentlyEnabled: boolean
  requestedEnabled: boolean
  hasUsableKnowledge: boolean
}) {
  return !currentlyEnabled && requestedEnabled && !hasUsableKnowledge
}
