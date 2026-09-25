import { describe, expect, it } from 'vitest'
import { getInstagramQuestionByAssistantId } from './supervised-learning'

describe('Instagram supervised learning', () => {
  it('groups consecutive inbound DMs into the question answered by TALIA', () => {
    const questions = getInstagramQuestionByAssistantId([
      { id: '1', direction: 'inbound', body_text: 'Hola' },
      { id: '2', direction: 'inbound', body_text: '¿El museo es accesible?' },
      { id: '3', direction: 'outbound', body_text: 'Sí, el museo es accesible.', is_operator_reply: false },
    ])

    expect(questions.get('3')).toBe('Hola\n¿El museo es accesible?')
  })

  it('does not offer human replies as reusable TALIA answers', () => {
    const questions = getInstagramQuestionByAssistantId([
      { id: '1', direction: 'inbound', body_text: 'Necesito ayuda' },
      { id: '2', direction: 'outbound', body_text: 'Respuesta humana', is_operator_reply: true },
    ])

    expect(questions.has('2')).toBe(false)
  })
})
