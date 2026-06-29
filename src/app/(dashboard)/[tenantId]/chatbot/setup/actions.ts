'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
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
    tone: formData.get('tone') || 'close',
    fallbackBehavior: formData.get('fallback_behavior') || 'contact',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const { data: theatre, error: fetchError } = await admin
    .from('theatres')
    .select('widget_config')
    .eq('id', tenantId)
    .single()

  if (fetchError) {
    return { ok: false, message: `No se pudo cargar la configuración actual: ${fetchError.message}` }
  }

  const existingWidget = isPlainObject(theatre?.widget_config)
    ? theatre.widget_config as Record<string, Json>
    : {}
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
    })
    .eq('id', tenantId)

  if (error) {
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath(`/${tenantId}/chatbot/setup`)
  revalidatePath(`/${tenantId}/settings`)
  revalidatePath(`/${tenantId}/overview`)
  redirect(`/${tenantId}/overview`)
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
