// Voices a venue can choose for its Web Agent's spoken replies, a subset of
// the OpenAI text-to-speech voices accepted by talia-ai's /v1/voice/speech.
// MVP: three clearly different voices. talia-ai accepts more OpenAI voices,
// so this list can grow later without a contract change.
export const AGENT_VOICES = [
  'coral',
  'sage',
  'ash',
] as const

export type AgentVoice = (typeof AGENT_VOICES)[number]

export const DEFAULT_AGENT_VOICE: AgentVoice = 'coral'

export function isAgentVoice(value: unknown): value is AgentVoice {
  return typeof value === 'string' && (AGENT_VOICES as readonly string[]).includes(value)
}

export function normalizeAgentVoice(value: unknown): AgentVoice {
  return isAgentVoice(value) ? value : DEFAULT_AGENT_VOICE
}

/** Reads the venue's voice from `theatres.widget_config` (key `agentVoice`). */
export function getAgentVoiceFromWidgetConfig(widgetConfig: unknown): AgentVoice {
  if (!widgetConfig || typeof widgetConfig !== 'object' || Array.isArray(widgetConfig)) {
    return DEFAULT_AGENT_VOICE
  }
  const config = widgetConfig as { agentVoice?: unknown; agent_voice?: unknown }
  return normalizeAgentVoice(config.agentVoice ?? config.agent_voice)
}

/**
 * Whether the Web Agent shows its voice controls (microphone, read-aloud,
 * keyboard shortcut, hands-free). On unless the venue switches it off in
 * Agora, so venues that never touched the setting keep voice.
 */
export function isVoiceControlEnabled(widgetConfig: unknown): boolean {
  if (!widgetConfig || typeof widgetConfig !== 'object' || Array.isArray(widgetConfig)) return true
  const config = widgetConfig as { voiceEnabled?: unknown; voice_enabled?: unknown }
  return (config.voiceEnabled ?? config.voice_enabled) !== false
}

/**
 * The venue's saved "invite visitors to talk" choice, kept even while voice
 * is switched off so it comes back when voice is turned on again.
 */
export function isVoiceInvitationSaved(widgetConfig: unknown): boolean {
  if (!widgetConfig || typeof widgetConfig !== 'object' || Array.isArray(widgetConfig)) return false
  const config = widgetConfig as { voiceInvitation?: unknown; voice_invitation?: unknown }
  return (config.voiceInvitation ?? config.voice_invitation) === true
}

/**
 * Whether the venue invites visitors to turn on voice ("Di «Hola TALIA»") on
 * their first visit. Off unless explicitly enabled, and never while voice is
 * switched off; the microphone still only turns on after the visitor accepts.
 */
export function isVoiceInvitationEnabled(widgetConfig: unknown): boolean {
  return isVoiceControlEnabled(widgetConfig) && isVoiceInvitationSaved(widgetConfig)
}

type VoiceLocale = 'es' | 'ca' | 'en' | 'pt-BR'

// Short, human descriptions to help a venue pick; they can listen to each one.
const VOICE_DESCRIPTIONS: Record<VoiceLocale, Record<AgentVoice, string>> = {
  es: {
    coral: 'Femenina, cálida y cercana',
    sage: 'Femenina, serena y pausada',
    ash: 'Masculina, clara y directa',
  },
  ca: {
    coral: 'Femenina, càlida i propera',
    sage: 'Femenina, serena i pausada',
    ash: 'Masculina, clara i directa',
  },
  en: {
    coral: 'Female, warm and friendly',
    sage: 'Female, calm and measured',
    ash: 'Male, clear and direct',
  },
  'pt-BR': {
    coral: 'Feminina, calorosa e próxima',
    sage: 'Feminina, serena e pausada',
    ash: 'Masculina, clara e direta',
  },
}

const PREVIEW_SAMPLES: Record<VoiceLocale, string> = {
  es: 'Hola, soy TALIA. Esta noche abrimos puertas a las siete y media. ¿Te ayudo a encontrar entradas?',
  ca: 'Hola, soc la TALIA. Aquesta nit obrim portes a dos quarts de vuit. T’ajudo a trobar entrades?',
  en: 'Hi, I’m TALIA. Tonight doors open at half past seven. Can I help you find tickets?',
  'pt-BR': 'Olá, sou a TALIA. Hoje as portas abrem às sete e meia. Posso ajudar você a encontrar ingressos?',
}

function toVoiceLocale(language: string | null | undefined): VoiceLocale {
  const value = String(language ?? '').toLowerCase()
  if (value.startsWith('pt')) return 'pt-BR'
  if (value.startsWith('ca')) return 'ca'
  if (value.startsWith('en')) return 'en'
  return 'es'
}

export function getAgentVoiceOptions(language: string | null | undefined) {
  const descriptions = VOICE_DESCRIPTIONS[toVoiceLocale(language)]
  return AGENT_VOICES.map((voice) => ({
    value: voice,
    label: voice.charAt(0).toUpperCase() + voice.slice(1),
    description: descriptions[voice],
  }))
}

/** Sample sentence for the Agora "listen" button, in the venue's language. */
export function getAgentVoicePreviewSample(language: string | null | undefined) {
  const locale = toVoiceLocale(language)
  return { text: PREVIEW_SAMPLES[locale], language: locale === 'pt-BR' ? 'pt-BR' : locale }
}
