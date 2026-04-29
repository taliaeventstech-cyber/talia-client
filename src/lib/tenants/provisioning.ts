import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type CreateTenantInput = {
  userId: string
  userEmail: string
  theatreName: string
  websiteUrl?: string
  fallbackEmail?: string
  fallbackPhone?: string
  assistantName?: string
  primaryColor?: string
}

export async function createTenantForUser(admin: AdminClient, input: CreateTenantInput) {
  const slug = await getAvailableSlug(admin, slugify(input.theatreName))
  const scrapeUrls = input.websiteUrl ? [input.websiteUrl] : []
  const widgetConfig = {
    assistantName: input.assistantName || 'TALIA',
    primaryColor: input.primaryColor || '#000000',
  } satisfies Json

  const { data: theatre, error: theatreError } = await admin
    .from('theatres')
    .insert({
      name: input.theatreName,
      slug,
      plan: 'esencial',
      fallback_email: input.fallbackEmail || input.userEmail,
      fallback_phone: input.fallbackPhone || null,
      scrape_urls: scrapeUrls,
      widget_config: widgetConfig,
      system_prompt: buildInitialSystemPrompt(input.theatreName, input.websiteUrl),
      n8n_webhook_url: getDefaultN8nWebhookUrl(),
    })
    .select('id')
    .single()

  if (theatreError || !theatre) {
    return { ok: false as const, error: theatreError?.message ?? 'Could not create tenant' }
  }

  const { error: userError } = await admin
    .from('users')
    .upsert({
      id: input.userId,
      theatre_id: theatre.id,
      email: input.userEmail,
      role: 'admin',
    }, { onConflict: 'id' })

  if (userError) {
    return { ok: false as const, error: userError.message }
  }

  return { ok: true as const, tenantId: theatre.id }
}

function getDefaultN8nWebhookUrl() {
  return process.env.DEFAULT_N8N_WEBHOOK_URL || null
}

function buildInitialSystemPrompt(theatreName: string, websiteUrl?: string) {
  const websiteLine = websiteUrl ? `Web oficial: ${websiteUrl}` : null

  return [
    `Eres TALIA, el asistente virtual de ${theatreName}.`,
    'Ayuda a los visitantes con información práctica, programación, entradas, horarios, ubicación y accesibilidad.',
    websiteLine,
    'Responde siempre de forma clara, breve y profesional.',
    'Si no sabes una respuesta con seguridad, deriva al contacto oficial del teatro.',
  ].filter(Boolean).join('\n')
}

async function getAvailableSlug(admin: AdminClient, baseSlug: string) {
  const base = baseSlug || 'teatro'
  let candidate = base
  let suffix = 2

  while (await slugExists(admin, candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

async function slugExists(admin: AdminClient, slug: string) {
  const { data } = await admin
    .from('theatres')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  return Boolean(data)
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
