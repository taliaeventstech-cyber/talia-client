'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import type { Json } from '@/types/database.types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type AccessibilitySettingsFormState = {
  ok: boolean
  message: string
}

const accessibilitySettingsSchema = z.object({
  enabled: z.boolean(),
  clearViewEnabled: z.boolean(),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  widgetSize: z.enum(['small', 'medium', 'large']),
  language: z.enum(['auto', 'es', 'ca', 'en']),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal'),
  highlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color de resaltado debe estar en formato hexadecimal'),
})

export async function updateAccessibilitySettings(
  tenantId: string,
  _previousState: AccessibilitySettingsFormState,
  formData: FormData,
): Promise<AccessibilitySettingsFormState> {
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, message: 'No tienes permisos para editar esta configuración.' }

  const parsed = accessibilitySettingsSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    clearViewEnabled: formData.get('clear_view_enabled') === 'on',
    position: formData.get('position') || 'bottom-right',
    widgetSize: formData.get('widget_size') || 'medium',
    language: formData.get('language') || 'auto',
    primaryColor: formData.get('primary_color') || '#00e0c7',
    highlightColor: formData.get('highlight_color') || '#fffb00',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'La configuración no es válida.' }
  }

  const { data: theatre } = await admin
    .from('theatres')
    .select('widget_config')
    .eq('id', tenantId)
    .single()
  const widgetConfig = isPlainObject(theatre?.widget_config)
    ? theatre.widget_config as Record<string, Json>
    : {}
  const accessibility = isPlainObject(widgetConfig.accessibility)
    ? widgetConfig.accessibility
    : getDefaultAccessibilityConfig()

  const { error } = await admin
    .from('theatres')
    .update({
      widget_config: {
        ...widgetConfig,
        accessibility: {
          ...accessibility,
          enabled: parsed.data.enabled,
          clearViewEnabled: parsed.data.clearViewEnabled,
          position: parsed.data.position,
          widgetSize: parsed.data.widgetSize,
          language: parsed.data.language,
          primaryColor: parsed.data.primaryColor,
          highlightColor: parsed.data.highlightColor,
        },
      } satisfies Json,
    })
    .eq('id', tenantId)

  if (error) return { ok: false, message: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/${tenantId}/accessibility/settings`)
  revalidatePath(`/${tenantId}/settings`)
  revalidatePath(`/${tenantId}/overview`)
  return { ok: true, message: 'Configuración de accesibilidad guardada correctamente.' }
}

function getDefaultAccessibilityConfig() {
  return {
    language: 'auto',
    highlightColor: '#fffb00',
    clearViewEnabled: true,
    showBranding: true,
    controls: {
      textSize: true,
      contrast: true,
      grayscale: true,
      highlightLinks: true,
      pauseAnimations: true,
      lineSpacing: true,
      readableFont: true,
      lowStimulation: true,
      readingMask: true,
      readingLine: true,
      highlightContent: true,
      readAloud: true,
      dyslexiaFont: true,
      profiles: true,
    },
  }
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
