import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type CulturalEntityType =
  | 'theatre'
  | 'museum'
  | 'cinema'
  | 'auditorium'
  | 'festival'
  | 'cultural_center'
  | 'other'

export type TenantLanguage = 'ca' | 'es' | 'en'

export type CreateTenantInput = {
  userId: string
  userEmail: string
  entityType: CulturalEntityType
  theatreName: string
  websiteUrl?: string
  fallbackEmail?: string
  fallbackPhone?: string
  primaryLanguage: TenantLanguage
  onboardingGoals: string[]
  primaryColor?: string
}

export async function createTenantForUser(admin: AdminClient, input: CreateTenantInput) {
  const slug = await getAvailableSlug(admin, slugify(input.theatreName))
  const scrapeUrls = input.websiteUrl ? [input.websiteUrl] : []
  const widgetConfig = {
    assistantName: 'TALIA',
    initialMessage: getInitialMessage(input.primaryLanguage, input.entityType),
    primaryColor: input.primaryColor || '#000000',
  } satisfies Json

  const { data: theatre, error: theatreError } = await admin
    .from('theatres')
    .insert({
      name: input.theatreName,
      slug,
      entity_type: input.entityType,
      primary_language: input.primaryLanguage,
      website_url: input.websiteUrl || null,
      onboarding_goals: input.onboardingGoals,
      onboarding_completed: true,
      plan: 'esencial',
      fallback_email: input.fallbackEmail || input.userEmail,
      fallback_phone: input.fallbackPhone || null,
      scrape_urls: scrapeUrls,
      widget_config: widgetConfig,
      system_prompt: buildInitialSystemPrompt(input),
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

function buildInitialSystemPrompt(input: CreateTenantInput) {
  const websiteLine = input.websiteUrl ? `Web oficial: ${input.websiteUrl}` : null
  const languageLine = `Idioma principal: ${getLanguageName(input.primaryLanguage)}.`
  const goalsLine = input.onboardingGoals.length
    ? `Prioriza estas áreas: ${input.onboardingGoals.map(getGoalLabel).join(', ')}.`
    : null

  return [
    `Eres TALIA, el asistente virtual de ${input.theatreName}.`,
    `La entidad cultural es de tipo: ${getEntityTypeLabel(input.entityType)}.`,
    languageLine,
    'Ayuda a los visitantes con información práctica, programación, entradas o reservas, horarios, ubicación y accesibilidad.',
    goalsLine,
    websiteLine,
    'Responde siempre en el idioma del usuario, de forma clara, breve y profesional.',
    'Si no sabes una respuesta con seguridad, deriva al contacto oficial del teatro.',
  ].filter(Boolean).join('\n')
}

function getInitialMessage(language: TenantLanguage, entityType: CulturalEntityType) {
  const entity = getEntityTypeLabel(entityType).toLowerCase()

  if (language === 'ca') return `Hola, soc TALIA. En què et puc ajudar sobre ${entity}?`
  if (language === 'en') return `Hi, I am TALIA. How can I help you with this ${entity}?`
  return `Hola, soy TALIA. ¿En qué puedo ayudarte sobre ${entity}?`
}

function getLanguageName(language: TenantLanguage) {
  if (language === 'ca') return 'catalán'
  if (language === 'en') return 'inglés'
  return 'español'
}

function getEntityTypeLabel(entityType: CulturalEntityType) {
  const labels: Record<CulturalEntityType, string> = {
    theatre: 'teatro',
    museum: 'museo',
    cinema: 'cine',
    auditorium: 'auditorio o sala de conciertos',
    festival: 'festival',
    cultural_center: 'centro cultural',
    other: 'entidad cultural',
  }
  return labels[entityType]
}

function getGoalLabel(goal: string) {
  const labels: Record<string, string> = {
    faqs: 'preguntas frecuentes',
    agenda: 'programación y agenda',
    tickets: 'entradas y reservas',
    hours: 'horarios',
    location: 'ubicación y cómo llegar',
    accessibility: 'accesibilidad',
    prices: 'precios y descuentos',
  }
  return labels[goal] ?? goal
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
