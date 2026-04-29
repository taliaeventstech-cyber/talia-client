import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getTenantWebhookSecret(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('webhook_secret, n8n_hmac_secret')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  return {
    ok: true as const,
    secret: data.webhook_secret ?? data.n8n_hmac_secret,
  }
}

export async function assertTenantAdmin(admin: AdminClient, userId: string, tenantId: string) {
  const { data } = await admin
    .from('users')
    .select('role')
    .eq('id', userId)
    .eq('theatre_id', tenantId)
    .single()

  return data?.role === 'admin'
}
