export const DEFAULT_PRIVACY_URL = 'https://talia.events/privacy'

export type WidgetComplianceCopy = {
  aiLabel: string
  disclosure: string
  privacyLabel: string
  privacyQuestion: string
  privacySummary: string
  privacyMore: string
}

const COPY = {
  es: {
    aiLabel: 'Agente web',
    disclosure: 'Estás hablando con un asistente de IA. Puede cometer errores.',
    privacyLabel: 'Privacidad',
    privacyQuestion: '¿Cómo tratáis mis datos?',
    privacySummary: 'Usamos los mensajes que envías para responder a tu consulta, supervisar la calidad y proteger el servicio. El contenido de la conversación se conserva durante 90 días y puede eliminarse antes si lo solicitas. Si hablas con el agente, tu voz se transcribe y las respuestas pueden leerse en voz alta mediante proveedores de IA (como OpenAI) o el servicio de voz de tu navegador; no guardamos grabaciones de audio. Si activas el modo «Hola TALIA», tu navegador escucha el micrófono mientras esté activo para detectar esa frase. No vendemos tus datos.',
    privacyMore: 'Puedes consultar todos los detalles y cómo ejercer tus derechos aquí:',
  },
  ca: {
    aiLabel: 'Agent web',
    disclosure: 'Estàs parlant amb un assistent d’IA. Pot cometre errors.',
    privacyLabel: 'Privacitat',
    privacyQuestion: 'Com tracteu les meves dades?',
    privacySummary: 'Utilitzem els missatges que envies per respondre la teva consulta, supervisar la qualitat i protegir el servei. El contingut de la conversa es conserva durant 90 dies i es pot eliminar abans si ho sol·licites. Si parles amb l’agent, la teva veu es transcriu i les respostes es poden llegir en veu alta mitjançant proveïdors d’IA (com OpenAI) o el servei de veu del teu navegador; no desem enregistraments d’àudio. Si actives el mode «Hola TALIA», el teu navegador escolta el micròfon mentre estigui actiu per detectar aquesta frase. No venem les teves dades.',
    privacyMore: 'Pots consultar tots els detalls i com exercir els teus drets aquí:',
  },
  en: {
    aiLabel: 'Web agent',
    disclosure: 'You are talking to an AI assistant. It can make mistakes.',
    privacyLabel: 'Privacy',
    privacyQuestion: 'How do you use my data?',
    privacySummary: 'We use the messages you send to answer your question, monitor quality, and protect the service. Conversation content is retained for 90 days and can be deleted sooner if you request it. If you talk to the agent, your voice is transcribed and answers may be read aloud using AI providers (such as OpenAI) or your browser’s speech service; we do not keep audio recordings. If you turn on “Hello TALIA” mode, your browser listens to the microphone while it is on to detect that phrase. We do not sell your data.',
    privacyMore: 'You can read the full details and learn how to exercise your rights here:',
  },
  'pt-BR': {
    aiLabel: 'Agente web',
    disclosure: 'Você está falando com um assistente de IA. Ele pode cometer erros.',
    privacyLabel: 'Privacidade',
    privacyQuestion: 'Como vocês tratam meus dados?',
    privacySummary: 'Usamos as mensagens que você envia para responder à sua solicitação, supervisionar a qualidade e proteger o serviço. O conteúdo da conversa é mantido por 90 dias e pode ser excluído antes se você solicitar. Se você falar com o agente, sua voz é transcrita e as respostas podem ser lidas em voz alta por provedores de IA (como a OpenAI) ou pelo serviço de voz do seu navegador; não guardamos gravações de áudio. Se você ativar o modo “Olá TALIA”, seu navegador ouve o microfone enquanto estiver ativo para detectar essa frase. Não vendemos seus dados.',
    privacyMore: 'Você pode consultar todos os detalhes e saber como exercer seus direitos aqui:',
  },
} as const satisfies Record<string, WidgetComplianceCopy>

export function getWidgetComplianceCopy(language: unknown): WidgetComplianceCopy {
  if (typeof language !== 'string') return COPY.es
  const normalized = language.trim().toLowerCase().replace('_', '-')
  if (normalized === 'pt' || normalized.startsWith('pt-')) return COPY['pt-BR']
  if (normalized === 'ca' || normalized.startsWith('ca-')) return COPY.ca
  if (normalized === 'en' || normalized.startsWith('en-')) return COPY.en
  return COPY.es
}

export function normalizePrivacyUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_PRIVACY_URL

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return DEFAULT_PRIVACY_URL
    url.username = ''
    url.password = ''
    url.hash = ''
    return url.toString()
  } catch {
    return DEFAULT_PRIVACY_URL
  }
}
