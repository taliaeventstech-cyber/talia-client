import { describe, expect, it } from 'vitest'
import { getWhatsappQuestionByAssistantId } from './supervised-learning'

describe('WhatsApp supervised learning', () => {
  it('groups a burst of inbound messages into the question answered by TALIA', () => {
    const questions = getWhatsappQuestionByAssistantId([
      { id: '1', direction: 'inbound', body_text: 'Hello' },
      { id: '2', direction: 'inbound', body_text: 'Is the theatre' },
      { id: '3', direction: 'inbound', body_text: 'accessible?' },
      { id: '4', direction: 'outbound', body_text: 'Yes, it is accessible.', is_operator_reply: false },
    ])

    expect(questions.get('4')).toBe('Hello\nIs the theatre\naccessible?')
  })

  it('does not offer operator replies as reusable TALIA answers', () => {
    const questions = getWhatsappQuestionByAssistantId([
      { id: '1', direction: 'inbound', body_text: 'Can I get help?' },
      { id: '2', direction: 'outbound', body_text: 'A human reply', is_operator_reply: true },
    ])

    expect(questions.has('2')).toBe(false)
  })
})
