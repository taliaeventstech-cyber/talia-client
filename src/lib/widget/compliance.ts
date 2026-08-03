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
    privacySummary: 'Usamos los mensajes que envías para responder a tu consulta, supervisar la calidad y proteger el servicio. El contenido de la conversación se conserva durante 90 días y puede eliminarse antes si lo solicitas. No vendemos tus datos.',
    privacyMore: 'Puedes consultar todos los detalles y cómo ejercer tus derechos aquí:',
  },
  ca: {
    aiLabel: 'Agent web',
    disclosure: 'Estàs parlant amb un assistent d’IA. Pot cometre errors.',
    privacyLabel: 'Privacitat',
    privacyQuestion: 'Com tracteu les meves dades?',
    privacySummary: 'Utilitzem els missatges que envies per respondre la teva consulta, supervisar la qualitat i protegir el servei. El contingut de la conversa es conserva durant 90 dies i es pot eliminar abans si ho sol·licites. No venem les teves dades.',
    privacyMore: 'Pots consultar tots els detalls i com exercir els teus drets aquí:',
  },
  en: {
    aiLabel: 'Web agent',
    disclosure: 'You are talking to an AI assistant. It can make mistakes.',
    privacyLabel: 'Privacy',
    privacyQuestion: 'How do you use my data?',
    privacySummary: 'We use the messages you send to answer your question, monitor quality, and protect the service. Conversation content is retained for 90 days and can be deleted sooner if you request it. We do not sell your data.',
    privacyMore: 'You can read the full details and learn how to exercise your rights here:',
  },
  'pt-BR': {
    aiLabel: 'Agente web',
    disclosure: 'Você está falando com um assistente de IA. Ele pode cometer erros.',
    privacyLabel: 'Privacidade',
    privacyQuestion: 'Como vocês tratam meus dados?',
    privacySummary: 'Usamos as mensagens que você envia para responder à sua solicitação, supervisionar a qualidade e proteger o serviço. O conteúdo da conversa é mantido por 90 dias e pode ser excluído antes se você solicitar. Não vendemos seus dados.',
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
