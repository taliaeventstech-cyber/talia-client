type WhatsappLearningMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body_text: string | null
  is_operator_reply?: boolean
}

export function getWhatsappQuestionByAssistantId(messages: WhatsappLearningMessage[]) {
  const questions = new Map<string, string>()
  let inboundBurst: string[] = []

  for (const message of messages) {
    const body = message.body_text?.trim()
    if (message.direction === 'inbound') {
      if (body) inboundBurst.push(body)
      continue
    }

    if (body && !message.is_operator_reply && inboundBurst.length > 0) {
      questions.set(message.id, inboundBurst.join('\n').slice(0, 500))
    }
    inboundBurst = []
  }

  return questions
}
