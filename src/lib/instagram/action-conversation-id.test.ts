import { describe, expect, it } from 'vitest'
import { resolveInstagramActionConversationId } from './action-conversation-id'

describe('resolveInstagramActionConversationId', () => {
  const boundConversationId = '87acb1c3-28d1-4270-ad96-8b645c2be3e9'
  const visibleConversationId = '464e6dc1-5080-405c-a372-cea72747f526'

  it('uses the conversation rendered in the submitted form', () => {
    const formData = new FormData()
    formData.set('conversationId', visibleConversationId)

    expect(resolveInstagramActionConversationId(boundConversationId, formData))
      .toBe(visibleConversationId)
  })

  it('falls back to the bound conversation for older forms', () => {
    expect(resolveInstagramActionConversationId(boundConversationId, new FormData()))
      .toBe(boundConversationId)
  })

  it('does not accept a malformed submitted conversation id', () => {
    const formData = new FormData()
    formData.set('conversationId', 'not-a-conversation-id')

    expect(resolveInstagramActionConversationId(boundConversationId, formData))
      .toBe(boundConversationId)
  })
})
