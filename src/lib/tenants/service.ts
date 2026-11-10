import type { createAdminClient } from '@/lib/supabase/admin'
import { getAgentVoiceFromWidgetConfig, type AgentVoice } from '@/lib/widget/agent-voices'
import { getBillingAccess } from '@/lib/billing/access'
import { normalizeChatbotAiSettings, type ChatbotAiSettings } from '@/lib/chatbot/ai-settings'
import type { Json } from '@/types/database.types'
import { normalizeWidgetLauncherIcon, type WidgetLauncherIcon } from '@/lib/widget/launcher-icon'
import { normalizeProactiveGreeting } from '@/lib/widget/proactive-greeting'
import { isChatbotEnabled } from '@/lib/widget/availability'
import { getWidgetComplianceCopy, normalizePrivacyUrl, type WidgetComplianceCopy } from '@/lib/widget/compliance'
import {
  getInstalledWebCaptureSettingsFromWidgetConfig,
  type InstalledWebCaptureSettings,
} from '@/lib/knowledge/installed-web-capture-settings'
import {
  normalizeSuggestedQuestions,
  normalizeWidgetLanguage,
  type SuggestedQuestion,
  type WidgetLanguage,
} from '@/lib/widget/suggested-questions'

type AdminClient = ReturnType<typeof createAdminClient>

export type PublicWidgetConfig = {
  enabled: boolean
  tenantId: string
  name: string
  assistantName: string
  initialMessage: string
  primaryColor: string
  position: WidgetPosition
  widgetSize: WidgetSize
  inlineOffset: number
  blockOffset: number
  collisionStrategy: WidgetCollisionStrategy
  widgetTheme: WidgetTheme
  launcherIcon: WidgetLauncherIcon
  glassBackground: WidgetGlassBackground
  glassBlur: number
  glassTranslucency: number
  fallbackEmail: string | null
  fallbackPhone: string | null
  autoOpen: boolean
  autoOpenDelay: number
  proactiveMessage: string
  fallbackLanguage: WidgetLanguage
  suggestedQuestions: SuggestedQuestion[]
  compliance: WidgetComplianceCopy & { privacyUrl: string }
  installedWebCapture: InstalledWebCaptureSettings
  accessibility: PublicAccessibilityConfig
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type WidgetCollisionStrategy = 'auto' | 'none'
export type WidgetSize = 'small' | 'medium' | 'large'
// Visual material of the chat widget. `solid` is the classic opaque look;
// `glass` renders a translucent, frosted (iOS-style) chrome over the host site.
export type WidgetTheme = 'solid' | 'glass'
// Which glass variant to render — picked by the tone of the host site's background,
// since the widget floats over the client's own page (we can't detect it reliably).
export type WidgetGlassBackground = 'light' | 'dark'
// Bounds for the glass tuning controls (shared by settings, widget and normalizers).
export const GLASS_BLUR_MIN = 0
export const GLASS_BLUR_MAX = 30
export const GLASS_BLUR_DEFAULT = 18
export const GLASS_TRANSLUCENCY_MIN = 15
export const GLASS_TRANSLUCENCY_MAX = 85
export const GLASS_TRANSLUCENCY_DEFAULT = 58
export type ChatbotResponseTone = 'close' | 'formal' | 'brief'

export type PublicAccessibilityConfig = {
  enabled: boolean
  clearViewEnabled: boolean
  position: WidgetPosition
  widgetSize: WidgetSize
  language: 'auto' | 'es' | 'ca' | 'en'
  primaryColor: string
  highlightColor: string
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
    readingMask: boolean
    readingLine: boolean
    highlightContent: boolean
    readAloud: boolean
    dyslexiaFont: boolean
    profiles: boolean
  }
}

export type TenantChatConfig = {
  tenantId: string
  n8nWebhookUrl: string | null
  name: string
  language: string
  responseTone: ChatbotResponseTone
  systemPrompt: string | null
  fallbackEmail: string | null
  fallbackPhone: string | null
  websiteUrl: string | null
  aiSettings: ChatbotAiSettings
  suggestedQuestions: SuggestedQuestion[]
  /** Voice chosen in Agora for spoken Web Agent replies. */
  agentVoice?: AgentVoice
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
  const [{ data: profile }, { data: platformAdmin }, { data: theatre }] = await Promise.all([
    admin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle(),
    admin
      .from('platform_admins')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('theatres')
      .select('account_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  if (platformAdmin) return true
  if (!profile || !theatre) return false

  const [{ data: venueMembership }, { data: accountMembership }] = await Promise.all([
    admin
      .from('venue_memberships')
      .select('role')
      .eq('profile_id', profile.id)
      .eq('theatre_id', tenantId)
      .is('revoked_at', null)
      .maybeSingle(),
    admin
      .from('account_memberships')
      .select('role')
      .eq('profile_id', profile.id)
      .eq('account_id', theatre.account_id)
      .is('revoked_at', null)
      .maybeSingle(),
  ])

  return venueMembership?.role === 'owner' ||
    venueMembership?.role === 'admin' ||
    accountMembership?.role === 'owner' ||
    accountMembership?.role === 'admin'
}

export async function getPublicWidgetConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, name, primary_language, fallback_email, fallback_phone, widget_config, accounts(status, created_at, metadata)')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  if (!hasRuntimeAccess(data.accounts)) {
    return { ok: false as const, error: 'Trial expired or subscription inactive' }
  }

  const widgetConfig = getWidgetConfig(data.widget_config, data.primary_language)

  return {
    ok: true as const,
    config: {
      enabled: widgetConfig.enabled,
      tenantId: data.id,
      name: data.name,
      assistantName: widgetConfig.assistantName,
      initialMessage: widgetConfig.initialMessage,
      primaryColor: widgetConfig.primaryColor,
      position: widgetConfig.position,
      widgetSize: widgetConfig.widgetSize,
      inlineOffset: widgetConfig.inlineOffset,
      blockOffset: widgetConfig.blockOffset,
      collisionStrategy: widgetConfig.collisionStrategy,
      widgetTheme: widgetConfig.widgetTheme,
      launcherIcon: widgetConfig.launcherIcon,
      glassBackground: widgetConfig.glassBackground,
      glassBlur: widgetConfig.glassBlur,
      glassTranslucency: widgetConfig.glassTranslucency,
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
      autoOpen: widgetConfig.autoOpen,
      autoOpenDelay: widgetConfig.autoOpenDelay,
      proactiveMessage: normalizeProactiveGreeting(widgetConfig.proactiveMessage, data.primary_language, widgetConfig.assistantName),
      fallbackLanguage: normalizeWidgetLanguage(data.primary_language),
      suggestedQuestions: widgetConfig.suggestedQuestions,
      compliance: {
        ...getWidgetComplianceCopy(data.primary_language),
        privacyUrl: widgetConfig.privacyUrl,
      },
      installedWebCapture: widgetConfig.installedWebCapture,
      accessibility: widgetConfig.accessibility,
    } satisfies PublicWidgetConfig,
  }
}

export async function getTenantChatConfig(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('id, name, primary_language, system_prompt, n8n_webhook_url, fallback_email, fallback_phone, website_url, widget_config, accounts(status, created_at, metadata)')
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    return { ok: false as const, error: 'Tenant not found' }
  }

  if (!hasRuntimeAccess(data.accounts)) {
    return { ok: false as const, error: 'Trial expired or subscription inactive' }
  }

  const widgetConfig = getWidgetConfig(data.widget_config, data.primary_language)

  if (!widgetConfig.enabled) {
    return { ok: false as const, error: 'Chatbot is disabled' }
  }

  return {
    ok: true as const,
    config: {
      tenantId: data.id,
      n8nWebhookUrl: data.n8n_webhook_url,
      name: data.name,
      language: data.primary_language ?? 'es',
      responseTone: widgetConfig.tone,
      systemPrompt: data.system_prompt,
      fallbackEmail: data.fallback_email,
      fallbackPhone: data.fallback_phone,
      websiteUrl: data.website_url,
      aiSettings: widgetConfig.aiSettings,
      suggestedQuestions: widgetConfig.suggestedQuestions,
      agentVoice: getAgentVoiceFromWidgetConfig(data.widget_config),
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
      .select('id, name, primary_language, system_prompt, fallback_email, fallback_phone, widget_config')
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
  const widgetConfig = getWidgetConfig(data.widget_config, data.primary_language)
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
      topicCategories: ['agenda', 'precios', 'horarios', 'ubicacion', 'visita', 'entradas', 'accesibilidad', 'otro'],
      knowledgeItems,
    } satisfies TenantRuntimeChatConfig,
  }
}

function getWidgetConfig(value: unknown, language: unknown = 'es') {
  if (!value || typeof value !== 'object') {
    return {
      enabled: true,
      assistantName: 'TALIA',
      initialMessage: 'Hola, soc TALIA. En què et puc ajudar?',
      primaryColor: '#000000',
      position: 'bottom-right' as const,
      widgetSize: 'medium' as const,
      inlineOffset: 20,
      blockOffset: 20,
      collisionStrategy: 'auto' as const,
      widgetTheme: 'solid' as const,
      launcherIcon: normalizeWidgetLauncherIcon(undefined),
      glassBackground: 'light' as const,
      glassBlur: GLASS_BLUR_DEFAULT,
      glassTranslucency: GLASS_TRANSLUCENCY_DEFAULT,
      autoOpen: false,
      autoOpenDelay: 3,
      proactiveMessage: undefined,
      privacyUrl: normalizePrivacyUrl(undefined),
      suggestedQuestions: [],
      installedWebCapture: getInstalledWebCaptureSettingsFromWidgetConfig(undefined),
      tone: 'close' as const,
      accessibility: getAccessibilityConfig(undefined, '#000000'),
      aiSettings: normalizeChatbotAiSettings(undefined),
    }
  }

  const config = value as {
    enabled?: unknown
    assistantName?: unknown
    initialMessage?: unknown
    primaryColor?: unknown
    position?: unknown
    widgetSize?: unknown
    widget_size?: unknown
    size?: unknown
    inlineOffset?: unknown
    inline_offset?: unknown
    blockOffset?: unknown
    block_offset?: unknown
    collisionStrategy?: unknown
    collision_strategy?: unknown
    widgetTheme?: unknown
    widget_theme?: unknown
    launcherIcon?: unknown
    launcher_icon?: unknown
    glassBackground?: unknown
    glass_background?: unknown
    glassBlur?: unknown
    glass_blur?: unknown
    glassTranslucency?: unknown
    glass_translucency?: unknown
    autoOpen?: unknown
    autoOpenDelay?: unknown
    proactiveMessage?: unknown
    proactive_message?: unknown
    privacyUrl?: unknown
    privacy_url?: unknown
    suggestedQuestions?: unknown
    suggested_questions?: unknown
    tone?: unknown
    accessibility?: unknown
    chatbotAi?: unknown
    chatbot_ai?: unknown
    installedWebCapture?: unknown
    installed_web_capture?: unknown
  }
  const primaryColor = typeof config.primaryColor === 'string' ? config.primaryColor : '#000000'

  return {
    enabled: isChatbotEnabled(config.enabled),
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    primaryColor,
    position: getWidgetPosition(config.position, 'bottom-right'),
    widgetSize: getWidgetSize(config.widgetSize ?? config.widget_size ?? config.size),
    inlineOffset: getPixelOffset(config.inlineOffset ?? config.inline_offset, 20),
    blockOffset: getPixelOffset(config.blockOffset ?? config.block_offset, 20),
    collisionStrategy: getCollisionStrategy(config.collisionStrategy ?? config.collision_strategy),
    widgetTheme: getWidgetTheme(config.widgetTheme ?? config.widget_theme),
    launcherIcon: normalizeWidgetLauncherIcon(config.launcherIcon ?? config.launcher_icon),
    glassBackground: getGlassBackground(config.glassBackground ?? config.glass_background),
    glassBlur: getGlassBlur(config.glassBlur ?? config.glass_blur),
    glassTranslucency: getGlassTranslucency(config.glassTranslucency ?? config.glass_translucency),
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
    proactiveMessage: config.proactiveMessage ?? config.proactive_message,
    privacyUrl: normalizePrivacyUrl(config.privacyUrl ?? config.privacy_url),
    suggestedQuestions: normalizeSuggestedQuestions(
      config.suggestedQuestions ?? config.suggested_questions,
      language,
    ),
    installedWebCapture: getInstalledWebCaptureSettingsFromWidgetConfig(config),
    tone: getChatbotResponseTone(config.tone),
    accessibility: getAccessibilityConfig(config.accessibility, primaryColor),
    aiSettings: normalizeChatbotAiSettings(config.chatbotAi ?? config.chatbot_ai),
  }
}

function getPixelOffset(value: unknown, fallback: number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(320, Math.max(12, Math.round(numericValue)))
}

function getCollisionStrategy(value: unknown): WidgetCollisionStrategy {
  return value === 'none' ? 'none' : 'auto'
}

function getWidgetSize(value: unknown): WidgetSize {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

function getWidgetTheme(value: unknown): WidgetTheme {
  return value === 'glass' ? 'glass' : 'solid'
}

function getGlassBackground(value: unknown): WidgetGlassBackground {
  return value === 'dark' ? 'dark' : 'light'
}

function getGlassBlur(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return GLASS_BLUR_DEFAULT
  return Math.min(GLASS_BLUR_MAX, Math.max(GLASS_BLUR_MIN, Math.round(numeric)))
}

function getGlassTranslucency(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return GLASS_TRANSLUCENCY_DEFAULT
  return Math.min(GLASS_TRANSLUCENCY_MAX, Math.max(GLASS_TRANSLUCENCY_MIN, Math.round(numeric)))
}

function getChatbotResponseTone(value: unknown): ChatbotResponseTone {
  if (value === 'formal' || value === 'brief' || value === 'close') return value
  return 'close'
}

function getAccessibilityConfig(value: unknown, fallbackColor: string): PublicAccessibilityConfig {
  const config = value && typeof value === 'object'
    ? value as {
      enabled?: unknown
      clearViewEnabled?: unknown
      position?: unknown
      widgetSize?: unknown
      widget_size?: unknown
      size?: unknown
      language?: unknown
      primaryColor?: unknown
      highlightColor?: unknown
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
    widgetSize: getWidgetSize(config.widgetSize ?? config.widget_size ?? config.size),
    language: getAccessibilityLanguage(config.language),
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : fallbackColor,
    highlightColor: typeof config.highlightColor === 'string' ? config.highlightColor : '#fffb00',
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
      readingMask: controls.readingMask !== false && controls.focusReading !== false,
      readingLine: controls.readingLine !== false,
      highlightContent: controls.highlightContent !== false,
      readAloud: controls.readAloud !== false,
      dyslexiaFont: controls.dyslexiaFont !== false,
      profiles: controls.profiles !== false,
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
