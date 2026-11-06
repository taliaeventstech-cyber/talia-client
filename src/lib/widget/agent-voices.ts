// Voices a venue can choose for its Web Agent's spoken replies. They mirror
// the OpenAI text-to-speech voices accepted by talia-ai's /v1/voice/speech.
export const AGENT_VOICES = [
  'coral',
  'nova',
  'sage',
  'shimmer',
  'alloy',
  'ballad',
  'verse',
  'ash',
  'echo',
  'onyx',
  'fable',
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

type VoiceLocale = 'es' | 'ca' | 'en' | 'pt-BR'

// Short, human descriptions to help a venue pick; they can listen to each one.
const VOICE_DESCRIPTIONS: Record<VoiceLocale, Record<AgentVoice, string>> = {
  es: {
    coral: 'Femenina, cálida y cercana',
    nova: 'Femenina, clara y animada',
    sage: 'Femenina, serena y pausada',
    shimmer: 'Femenina, suave',
    alloy: 'Neutra y equilibrada',
    ballad: 'Masculina, suave y expresiva',
    verse: 'Masculina, versátil',
    ash: 'Masculina, clara y directa',
    echo: 'Masculina, tranquila',
    onyx: 'Masculina, grave',
    fable: 'Narrativa y expresiva',
  },
  ca: {
    coral: 'Femenina, càlida i propera',
    nova: 'Femenina, clara i animada',
    sage: 'Femenina, serena i pausada',
    shimmer: 'Femenina, suau',
    alloy: 'Neutra i equilibrada',
    ballad: 'Masculina, suau i expressiva',
    verse: 'Masculina, versàtil',
    ash: 'Masculina, clara i directa',
    echo: 'Masculina, tranquil·la',
    onyx: 'Masculina, greu',
    fable: 'Narrativa i expressiva',
  },
  en: {
    coral: 'Female, warm and friendly',
    nova: 'Female, clear and upbeat',
    sage: 'Female, calm and measured',
    shimmer: 'Female, soft',
    alloy: 'Neutral and balanced',
    ballad: 'Male, soft and expressive',
    verse: 'Male, versatile',
    ash: 'Male, clear and direct',
    echo: 'Male, calm',
    onyx: 'Male, deep',
    fable: 'Storyteller, expressive',
  },
  'pt-BR': {
    coral: 'Feminina, calorosa e próxima',
    nova: 'Feminina, clara e animada',
    sage: 'Feminina, serena e pausada',
    shimmer: 'Feminina, suave',
    alloy: 'Neutra e equilibrada',
    ballad: 'Masculina, suave e expressiva',
    verse: 'Masculina, versátil',
    ash: 'Masculina, clara e direta',
    echo: 'Masculina, tranquila',
    onyx: 'Masculina, grave',
    fable: 'Narrativa e expressiva',
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
