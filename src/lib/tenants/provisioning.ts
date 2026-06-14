import type { createAdminClient } from '@/lib/supabase/admin'
import { createTrialMetadata } from '@/lib/billing/access'
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
  fullName?: string
  profileMetadata?: Json
  entityType: CulturalEntityType
  theatreName: string
  websiteUrl?: string
  fallbackEmail?: string
  fallbackPhone?: string
  primaryLanguage: TenantLanguage
  onboardingGoals: string[]
  primaryColor?: string
  chatbotInitialMessage?: string
  chatbotTone?: string
  fallbackBehavior?: string
  knowledgeUrls?: string[]
}

export async function createTenantForUser(admin: AdminClient, input: CreateTenantInput) {
  const now = new Date()
  const slug = await getAvailableSlug(admin, slugify(input.theatreName))
  const scrapeUrls = Array.from(new Set([
    input.websiteUrl,
    ...(input.knowledgeUrls ?? []),
  ].filter((url): url is string => Boolean(url))))
  const widgetConfig = {
    assistantName: 'TALIA',
    initialMessage: input.chatbotInitialMessage || getInitialMessage(input.primaryLanguage, input.entityType),
    primaryColor: input.primaryColor || '#00e5c8',
    position: 'bottom-right',
    tone: input.chatbotTone || 'close',
    fallbackBehavior: input.fallbackBehavior || 'contact',
    accessibility: {
      enabled: false,
      position: 'bottom-right',
      language: 'auto',
      primaryColor: input.primaryColor || '#00e5c8',
      highlightColor: '#fffb00',
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
      },
    },
  } satisfies Json
  const trialMetadata = {
    ...createTrialMetadata(now),
    commercial_plan: 'chatbot_email',
  } satisfies Json

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      name: input.theatreName,
      slug,
      billing_email: input.fallbackEmail || input.userEmail,
      plan: 'essential',
      status: 'trialing',
      metadata: trialMetadata,
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false as const, error: accountError?.message ?? 'Could not create account' }
  }

  const { data: theatre, error: theatreError } = await admin
    .from('theatres')
    .insert({
      account_id: account.id,
      name: input.theatreName,
      slug,
      entity_type: input.entityType,
      primary_language: input.primaryLanguage,
      website_url: input.websiteUrl || null,
      onboarding_goals: input.onboardingGoals,
      onboarding_completed: true,
      plan: 'essential',
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

  const enabledModules = getInitialModules()
  const { error: modulesError } = await admin
    .from('tenant_modules')
    .insert(enabledModules.map((moduleKey) => ({
      theatre_id: theatre.id,
      module_key: moduleKey,
      status: 'trial',
      enabled_at: now.toISOString(),
      config: {},
    })))

  if (modulesError) {
    return { ok: false as const, error: modulesError.message }
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

  const { data: profile } = await admin
    .from('profiles')
    .upsert({
      auth_user_id: input.userId,
      email: input.userEmail.toLowerCase(),
      full_name: input.fullName || null,
      metadata: input.profileMetadata ?? {},
      status: 'active',
    }, { onConflict: 'auth_user_id' })
    .select('id')
    .single()

  if (profile) {
    await Promise.all([
      admin
        .from('account_memberships')
        .upsert({
          account_id: account.id,
          profile_id: profile.id,
          role: 'admin',
        }, { onConflict: 'account_id,profile_id' }),
      admin
        .from('venue_memberships')
        .upsert({
          theatre_id: theatre.id,
          profile_id: profile.id,
          role: 'admin',
        }, { onConflict: 'theatre_id,profile_id' }),
    ])
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
    email: 'agente de email',
  }
  return labels[goal] ?? goal
}

function getInitialModules() {
  return ['chatbot', 'data', 'email']
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
