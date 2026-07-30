import { describe, expect, it } from 'vitest'
import { orderConversationMessagesByNewestTurn } from './message-order'

describe('conversation message order', () => {
  it('shows the newest turn first while keeping each question before its answer', () => {
    const messages = [
      { id: 'welcome', role: 'assistant' },
      { id: 'old-question', role: 'user' },
      { id: 'old-answer', role: 'assistant' },
      { id: 'new-question', role: 'user' },
      { id: 'new-answer', role: 'assistant' },
    ]

    expect(orderConversationMessagesByNewestTurn(messages).map((message) => message.id)).toEqual([
      'new-question',
      'new-answer',
      'old-question',
      'old-answer',
      'welcome',
    ])
  })

  it('does not mutate the chronological source array', () => {
    const messages = [
      { id: 'question', role: 'user' },
      { id: 'answer', role: 'assistant' },
    ]

    orderConversationMessagesByNewestTurn(messages)
    expect(messages.map((message) => message.id)).toEqual(['question', 'answer'])
  })
})
