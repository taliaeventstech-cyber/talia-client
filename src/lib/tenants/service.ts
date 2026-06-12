import type { createAdminClient } from '@/lib/supabase/admin'
import { getBillingAccess } from '@/lib/billing/access'
import type { Json } from '@/types/database.types'

type AdminClient = ReturnType<typeof createAdminClient>

export type PublicWidgetConfig = {
  tenantId: string
  name: string
  assistantName: string
  initialMessage: string
  primaryColor: string
  position: WidgetPosition
  fallbackEmail: string | null
  fallbackPhone: string | null
  autoOpen: boolean
  autoOpenDelay: number
  accessibility: PublicAccessibilityConfig
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export type PublicAccessibilityConfig = {
  enabled: boolean
  clearViewEnabled: boolean
  position: WidgetPosition
  language: 'auto' | 'es' | 'ca' | 'en'
  primaryColor: string
  showBranding: boolean
  controls: {
    textSize: boolean
    contrast: boolean
    grayscale: boolean
    highlightLinks: boolean
    pauseAnimations: boolean
    lineSpacing: boolean
    readableFont: boolean
    lowStimulation: boolean
    focusReading: boolean
  }
}

export type TenantChatConfig = {
  tenantId: string
  n8nWebhookUrl: string | null
}

export type KnowledgeFaqItem = {
  question: string
  answer: string
  category: string | null
  priority: number
  language: string
}

export type TenantRuntimeChatConfig = {
  tenantId: string
  name: string
  assistantName: string
  primaryColor: string
  systemPrompt: string
  fallbackEmail: string | null
  fallbackPhone: string | null
  scrapeUrls: string[]
  topicCategories: string[]
  knowledgeItems: KnowledgeFaqItem[]
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
  const [{ data }, { data: platformAdmin }] = await Promise.all([
    admin
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('theatre_id', tenantId)
      .single(),
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  return Boolean(platformAdmin) || data?.role === 'owner' || data?.role === 'admin'
}

export async function getPublicWidgetConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, name, fallback_email, fallback_phone, widget_config, accounts(status, created_at, metadata)')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  if (!hasRuntimeAccess(data.accounts)) {
    return { ok: false as const, error: 'Trial expired or subscription inactive' }
  }

  const widgetConfig = getWidgetConfig(data.widget_config)

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      name: data.name,
      assistantName: widgetConfig.assistantName,
      initialMessage: widgetConfig.initialMessage,
      primaryColor: widgetConfig.primaryColor,
      position: widgetConfig.position,
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
      autoOpen: widgetConfig.autoOpen,
      autoOpenDelay: widgetConfig.autoOpenDelay,
      accessibility: widgetConfig.accessibility,
    } satisfies PublicWidgetConfig,
  }
}

export async function getTenantChatConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, n8n_webhook_url, accounts(status, created_at, metadata)')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  if (!hasRuntimeAccess(data.accounts)) {
    return { ok: false as const, error: 'Trial expired or subscription inactive' }
  }

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      n8nWebhookUrl: data.n8n_webhook_url,
    } satisfies TenantChatConfig,
  }
}

export type TenantVoiceConfig = {
  tenantId: string
  name: string
  elevenLabsAgentId: string | null
  voiceEnabled: boolean
  voicePhoneNumber: string | null
  voicePhoneProvider: string
  voicePhoneMode: string
  voicePublicPhoneNumber: string | null
  voiceForwardingNotes: string | null
  voiceOperationalStatus: string
  voiceId: string | null
  voiceLanguage: string
  voiceTone: string
  voiceTemperature: number
  voiceSystemPrompt: string
  voiceCustomPrompt: string | null
  voiceMaxTurns: number
  fallbackEmail: string | null
  fallbackPhone: string | null
  knowledgeItems: KnowledgeFaqItem[]
}

export async function getTenantVoiceConfig(admin: AdminClient, tenantId: string) {
  const [theatreResult, knowledgeResult] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, fallback_email, fallback_phone, elevenlabs_agent_id, voice_enabled, voice_phone_number, voice_phone_provider, voice_phone_mode, voice_public_phone_number, voice_forwarding_notes, voice_operational_status, voice_id, voice_language, voice_tone, voice_temperature, voice_system_prompt, voice_max_turns')
      .eq('id', tenantId)
      .single(),
    admin
      .from('knowledge_items')
      .select('question, answer, category, priority, language')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(50),
  ])

  if (theatreResult.error || !theatreResult.data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  const data = theatreResult.data
  const knowledgeItems: KnowledgeFaqItem[] = (knowledgeResult.data ?? []).map((item) => ({
    question: item.question,
    answer: item.answer,
    category: item.category,
    priority: item.priority,
    language: item.language,
  }))

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      name: data.name,
      elevenLabsAgentId: data.elevenlabs_agent_id,
      voiceEnabled: data.voice_enabled,
      voicePhoneNumber: data.voice_phone_number,
      voicePhoneProvider: data.voice_phone_provider,
      voicePhoneMode: data.voice_phone_mode,
      voicePublicPhoneNumber: data.voice_public_phone_number,
      voiceForwardingNotes: data.voice_forwarding_notes,
      voiceOperationalStatus: data.voice_operational_status,
      voiceId: data.voice_id,
      voiceLanguage: data.voice_language,
      voiceTone: data.voice_tone,
      voiceTemperature: data.voice_temperature,
      voiceSystemPrompt: data.voice_system_prompt || '',
      voiceCustomPrompt: data.voice_system_prompt,
      voiceMaxTurns: data.voice_max_turns,
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
      knowledgeItems,
    } satisfies TenantVoiceConfig,
  }
}


export async function getTenantRuntimeChatConfig(admin: AdminClient, tenantId: string) {
  const [theatreResult, knowledgeResult] = await Promise.all([
    admin
      .from('theatres')
      .select('id, name, system_prompt, fallback_email, fallback_phone, scrape_urls, widget_config')
      .eq('id', tenantId)
      .single(),
    admin
      .from('knowledge_items')
      .select('question, answer, category, priority, language')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(50),
  ])

  if (theatreResult.error || !theatreResult.data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  const data = theatreResult.data
  const widgetConfig = getWidgetConfig(data.widget_config)
  const scrapeUrls = Array.isArray(data.scrape_urls)
    ? data.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []
  const knowledgeItems: KnowledgeFaqItem[] = (knowledgeResult.data ?? []).map((item) => ({
    question: item.question,
    answer: item.answer,
    category: item.category,
    priority: item.priority,
    language: item.language,
  }))

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      name: data.name,
      assistantName: widgetConfig.assistantName,
      primaryColor: widgetConfig.primaryColor,
      systemPrompt: data.system_prompt || buildDefaultSystemPrompt(data.name, data.fallback_email, data.fallback_phone),
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
      scrapeUrls,
      topicCategories: ['agenda', 'precios', 'horarios', 'ubicacion', 'visita', 'entradas', 'accesibilidad', 'otro'],
      knowledgeItems,
    } satisfies TenantRuntimeChatConfig,
  }
}

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      assistantName: 'TALIA',
      initialMessage: 'Hola, soc TALIA. En què et puc ajudar?',
      primaryColor: '#000000',
      position: 'bottom-right' as const,
      autoOpen: false,
      autoOpenDelay: 3,
      accessibility: getAccessibilityConfig(undefined, '#000000'),
    }
  }

  const config = value as {
    assistantName?: unknown
    initialMessage?: unknown
    primaryColor?: unknown
    position?: unknown
    autoOpen?: unknown
    autoOpenDelay?: unknown
    accessibility?: unknown
  }
  const primaryColor = typeof config.primaryColor === 'string' ? config.primaryColor : '#000000'

  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    primaryColor,
    position: getWidgetPosition(config.position, 'bottom-right'),
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
    accessibility: getAccessibilityConfig(config.accessibility, primaryColor),
  }
}

function getAccessibilityConfig(value: unknown, fallbackColor: string): PublicAccessibilityConfig {
  const config = value && typeof value === 'object'
    ? value as {
      enabled?: unknown
      clearViewEnabled?: unknown
      position?: unknown
      language?: unknown
      primaryColor?: unknown
      showBranding?: unknown
      controls?: unknown
    }
    : {}
  const controls = config.controls && typeof config.controls === 'object'
    ? config.controls as Record<string, unknown>
    : {}

  return {
    enabled: config.enabled === true,
    clearViewEnabled: config.clearViewEnabled !== false,
    position: getWidgetPosition(config.position, 'bottom-right'),
    language: getAccessibilityLanguage(config.language),
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : fallbackColor,
    showBranding: config.showBranding !== false,
    controls: {
      textSize: controls.textSize !== false,
      contrast: controls.contrast !== false,
      grayscale: controls.grayscale !== false,
      highlightLinks: controls.highlightLinks !== false,
      pauseAnimations: controls.pauseAnimations !== false,
      lineSpacing: controls.lineSpacing !== false,
      readableFont: controls.readableFont !== false,
      lowStimulation: controls.lowStimulation !== false,
      focusReading: controls.focusReading !== false,
    },
  }
}

function getWidgetPosition(value: unknown, fallback: WidgetPosition): WidgetPosition {
  if (
    value === 'bottom-right' ||
    value === 'bottom-left' ||
    value === 'top-right' ||
    value === 'top-left'
  ) {
    return value
  }

  return fallback
}

function getAccessibilityLanguage(value: unknown): PublicAccessibilityConfig['language'] {
  if (value === 'es' || value === 'ca' || value === 'en' || value === 'auto') return value
  return 'auto'
}

function hasRuntimeAccess(accountRelation: unknown) {
  const account = getAccount(accountRelation)
  const access = getBillingAccess({
    source: 'tenant',
    accountStatus: typeof account?.status === 'string' ? account.status : undefined,
    accountCreatedAt: typeof account?.created_at === 'string' ? account.created_at : null,
    accountMetadata: account?.metadata as Json | null | undefined,
  })

  return access.hasProductAccess
}

function getAccount(accountRelation: unknown) {
  if (Array.isArray(accountRelation)) return accountRelation[0] as Record<string, unknown> | undefined
  if (accountRelation && typeof accountRelation === 'object') return accountRelation as Record<string, unknown>
  return undefined
}

function buildDefaultSystemPrompt(name: string, fallbackEmail: string | null, fallbackPhone: string | null) {
  const fallback = [fallbackEmail, fallbackPhone].filter(Boolean).join(' o ')

  return [
    `Eres TALIA, el asistente virtual de ${name}.`,
    'Ayuda a los visitantes con información práctica sobre el teatro: programación, entradas, horarios, ubicación y accesibilidad.',
    'Responde siempre en el idioma del usuario y de forma breve, clara y profesional.',
    fallback ? `Si no sabes una respuesta con seguridad, deriva al usuario a ${fallback}.` : 'Si no sabes una respuesta con seguridad, deriva al usuario al contacto oficial del teatro.',
    'No inventes precios, disponibilidad ni políticas.',
  ].join('\n')
}
