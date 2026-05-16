import type { EmailAgentClassification } from './agent-provider'
import type { EmailClassification } from './classifier'

type SafeguardInput = {
  subject: string | null
  bodyText: string
  rulesClassification: EmailClassification
  agentClassification: EmailAgentClassification
}

const PARTNERSHIP_PATTERN = /\b(partnership|partner|collaboration|proposal|sponsorship|sponsor|press|media kit|colaboracion|collaboracio|propuesta|proposta|patrocinio|patrocini|prensa|comercial)\b/i

export function applyEmailClassificationSafeguards(input: SafeguardInput): EmailAgentClassification {
  if (!input.rulesClassification.shouldProcess) return input.agentClassification

  const fullText = normalizeText(`${input.subject ?? ''}\n${input.bodyText}`)
  if (!PARTNERSHIP_PATTERN.test(fullText)) return input.agentClassification

  return {
    ...input.agentClassification,
    shouldProcess: true,
    shouldReply: true,
    needsHumanReview: true,
    topic: input.agentClassification.topic ?? 'otro',
    priority: input.agentClassification.priority === 'low' ? 'normal' : input.agentClassification.priority,
    classificationReason: input.agentClassification.classificationReason === 'other' || !input.agentClassification.classificationReason
      ? 'partnership_request'
      : input.agentClassification.classificationReason,
    escalationReason: input.agentClassification.escalationReason ?? 'partnership_request',
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '')
    .toLowerCase()
}
