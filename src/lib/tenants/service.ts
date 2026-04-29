import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type PublicWidgetConfig = {
  tenantId: string
  name: string
  assistantName: string
  primaryColor: string
  fallbackEmail: string | null
  fallbackPhone: string | null
}

export type TenantChatConfig = {
  tenantId: string
  n8nWebhookUrl: string | null
}

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

export async function getPublicWidgetConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, name, fallback_email, fallback_phone, widget_config')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  const widgetConfig = getWidgetConfig(data.widget_config)

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      name: data.name,
      assistantName: widgetConfig.assistantName,
      primaryColor: widgetConfig.primaryColor,
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
    } satisfies PublicWidgetConfig,
  }
}

export async function getTenantChatConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, n8n_webhook_url')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      n8nWebhookUrl: data.n8n_webhook_url,
    } satisfies TenantChatConfig,
  }
}

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { assistantName: 'TALIA', primaryColor: '#000000' }
  }

  const config = value as { assistantName?: unknown; primaryColor?: unknown }
  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
  }
}
