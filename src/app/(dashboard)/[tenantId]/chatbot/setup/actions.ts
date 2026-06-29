'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { syncUrlKnowledgeSources } from '@/lib/knowledge/ingestion'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type ChatbotSetupState = {
  ok: boolean
  message: string
}

const setupSchema = z.object({
  initialMessage: z.string().trim().min(1, 'El mensaje inicial es obligatorio').max(300),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
  systemPrompt: z.string().trim().max(8000, 'El prompt no puede superar los 8000 caracteres').optional(),
  sourceUrl: z.string().trim().optional(),
  tone: z.enum(['close', 'formal', 'brief']),
  fallbackBehavior: z.enum(['contact', 'human', 'unknown']),
})

export async function saveChatbotSetup(
  tenantId: string,
  _previousState: ChatbotSetupState,
  formData: FormData
): Promise<ChatbotSetupState> {
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) {
    return { ok: false, message: 'No tienes permisos para configurar el chatbot.' }
  }

  const parsed = setupSchema.safeParse({
    initialMessage: formData.get('initial_message'),
    primaryColor: formData.get('primary_color'),
    systemPrompt: String(formData.get('system_prompt') ?? '').trim(),
    sourceUrl: normalizeUrl(String(formData.get('source_url') ?? '')),
    tone: formData.get('tone') || 'close',
    fallbackBehavior: formData.get('fallback_behavior') || 'contact',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const sourceUrlError = getUrlError(parsed.data.sourceUrl ?? '')
  if (sourceUrlError) {
    return { ok: false, message: sourceUrlError }
  }

  const { data: theatre, error: fetchError } = await admin
    .from('theatres')
    .select('widget_config, scrape_urls')
    .eq('id', tenantId)
    .single()

  if (fetchError) {
    return { ok: false, message: `No se pudo cargar la configuración actual: ${fetchError.message}` }
  }

  const existingWidget = isPlainObject(theatre?.widget_config)
    ? theatre.widget_config as Record<string, Json>
    : {}
  const existingUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string' && Boolean(url))
    : []
  const sourceUrl = parsed.data.sourceUrl
  const scrapeUrls = sourceUrl ? Array.from(new Set([...existingUrls, sourceUrl])) : existingUrls
  const widgetConfig = {
    ...existingWidget,
    assistantName: 'TALIA',
    initialMessage: parsed.data.initialMessage,
    primaryColor: parsed.data.primaryColor,
    tone: parsed.data.tone,
    fallbackBehavior: parsed.data.fallbackBehavior,
    setupCompleted: true,
    setupCompletedAt: new Date().toISOString(),
  } satisfies Json

  const { error } = await admin
    .from('theatres')
    .update({
      widget_config: widgetConfig,
      system_prompt: parsed.data.systemPrompt || null,
      scrape_urls: scrapeUrls,
    })
    .eq('id', tenantId)

  if (error) {
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  if (sourceUrl) {
    const indexed = await syncUrlKnowledgeSources({
      admin,
      tenantId,
      urls: scrapeUrls,
    })

    if (!indexed.ok) {
      console.warn('[chatbot-setup] URL knowledge sync failed after setup', {
        tenantId,
        error: indexed.message,
      })
    }
  }

  revalidatePath(`/${tenantId}/chatbot/setup`)
  revalidatePath(`/${tenantId}/settings`)
  revalidatePath(`/${tenantId}/overview`)
  redirect(`/${tenantId}/overview`)
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function getUrlError(value: string) {
  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'La web debe empezar por https:// o http://'
    }
    if (!parsed.hostname.includes('.')) {
      return 'Introduce un dominio válido, por ejemplo https://www.example.org'
    }
    return ''
  } catch {
    return 'Introduce una URL válida, por ejemplo https://www.example.org'
  }
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
