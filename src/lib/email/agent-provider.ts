import type { EmailAgentSettings } from './settings'

export type EmailAgentPriority = 'low' | 'normal' | 'high' | 'urgent'

export type EmailAgentKnowledgeHint = {
  question: string
  answer: string
  category: string | null
  priority: number
}

export type EmailAgentInput = {
  tenantId: string
  connectionId: string
  threadId: string
  messageId: string
  mailboxEmail: string
  subject: string | null
  senderEmail: string | null
  senderName: string | null
  bodyText: string
  fallbackEmail: string | null
  fallbackPhone: string | null
  knowledgeHints: EmailAgentKnowledgeHint[]
  agentSettings: EmailAgentSettings
}

export type EmailAgentClassification = {
  shouldProcess: boolean
  shouldGenerateDraft: boolean
  needsHumanReview: boolean
  topic: string | null
  priority: EmailAgentPriority
  confidence: number | null
  classificationReason: string | null
  escalationReason: string | null
  raw?: unknown
}

export type EmailAgentDraft = {
  shouldGenerateDraft: boolean
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  topic: string | null
  priority: EmailAgentPriority
  confidence: number | null
  escalationReason: string | null
  classificationReason: string | null
  raw?: unknown
}

export type EmailAgentProviderResult =
  | { ok: true; draft: EmailAgentDraft }
  | { ok: false; error: string; details?: string; status?: number }

export type EmailAgentClassificationResult =
  | { ok: true; classification: EmailAgentClassification }
  | { ok: false; error: string; details?: string; status?: number }

export interface EmailAgentProvider {
  generateDraft(input: EmailAgentInput): Promise<EmailAgentProviderResult>
}

export interface EmailAgentClassifierProvider {
  classify(input: EmailAgentInput): Promise<EmailAgentClassificationResult>
}

export interface EmailAgentDrafterProvider {
  generateDraft(input: EmailAgentInput & { classification: EmailAgentClassification }): Promise<EmailAgentProviderResult>
}
