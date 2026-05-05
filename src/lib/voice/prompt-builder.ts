import type { KnowledgeFaqItem } from '@/lib/tenants/service'

export type VoiceTone = 'warm' | 'professional' | 'neutral'

const TONE_PERSONALITY: Record<VoiceTone, string> = {
  warm:
    'friendly, empathetic, and enthusiastic. You make every caller feel welcome and valued, adapting your language to their familiarity with theatre and culture.',
  professional:
    'efficient, precise, and composed. You get to the point quickly while remaining courteous, prioritizing accuracy and brevity over small talk.',
  neutral:
    'balanced and clear. You are helpful and polite without being overly familiar, focusing on delivering accurate information in a natural conversational style.',
}

const TONE_INSTRUCTIONS: Record<VoiceTone, string> = {
  warm:
    "Your responses are warm and conversational, 2–3 sentences long. Use natural affirmations like 'Claro,' 'Por supuesto,' and 'Entendido.' Periodically check for understanding with phrases like '¿Le puedo ayudar con algo más?'",
  professional:
    "Your responses are concise and direct, 1–2 sentences. Avoid filler words. State the information clearly and confirm the user's need is met before closing.",
  neutral:
    "Your responses are clear and moderate in length, 2 sentences. Be polite and informative without being overly formal or overly casual.",
}

function buildKnowledgeSection(items: KnowledgeFaqItem[]): string {
  if (!items.length) return ''
  const lines = items.map((item) => `Q: ${item.question}\nA: ${item.answer}`)
  return `\n\n### Knowledge Base\nUse the following information to answer questions accurately:\n\n${lines.join('\n\n')}`
}

function buildFallbackLine(email: string | null, phone: string | null): string {
  const contacts = [phone, email].filter(Boolean).join(' or ')
  return contacts
    ? `If you cannot answer with certainty, escalate to a human agent and provide the contact: ${contacts}.`
    : `If you cannot answer with certainty, offer to escalate to a human agent.`
}

export function buildVoicePrompt(params: {
  theatreName: string
  tone: VoiceTone
  language: string
  knowledgeItems: KnowledgeFaqItem[]
  fallbackEmail: string | null
  fallbackPhone: string | null
}): string {
  const { theatreName, tone, language, knowledgeItems, fallbackEmail, fallbackPhone } = params

  const langLabel = language === 'ca' ? 'Catalan' : language === 'es' ? 'Spanish' : 'English'

  const sections = [
    `### Personality\nYou are TALIA, a ${TONE_PERSONALITY[tone]} virtual assistant for '${theatreName}'. You specialize in helping theatre-goers with programming, showtimes, prices, accessibility, and ticketing.`,

    `### Environment\nYou are in a voice call. The caller may be in a noisy environment or multitasking. Keep responses clear and concise. You have access to the theatre's knowledge base with event schedules, venue information, pricing, and ticketing details.`,

    `### Tone\n${TONE_INSTRUCTIONS[tone]} Respond always in ${langLabel}. Optimize speech for text-to-speech: articulate dates, times, and prices clearly.`,

    `### Goal\nEfficiently assist callers with:\n1. Specific event details (dates, times, prices, venue, synopsis).\n2. Recommendations based on preferences (genre, date, budget).\n3. Ticketing guidance (finding tickets, pricing, availability, purchase steps).\n4. General information (accessibility, FAQs, venue policies).\n5. Escalation: if the query is complex or requires account access, offer to connect them with a human agent.`,

    `### Guardrails\nStay within the scope of cultural events and services provided by '${theatreName}'. Never provide personal opinions, financial advice, or information unrelated to the arts. ${buildFallbackLine(fallbackEmail, fallbackPhone)} Do not invent prices, availability, or policies. If the user says goodbye, respond warmly and end with <end_call/>.`,
  ]

  return sections.join('\n\n') + buildKnowledgeSection(knowledgeItems)
}
