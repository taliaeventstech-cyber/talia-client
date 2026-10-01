import { describe, expect, it } from 'vitest'
import { parseInstagramActionContext } from './action-context'

describe('parseInstagramActionContext', () => {
  const tenantId = '1ff0588a-0a8c-4b2c-b7c5-1d2a027cba67'
  const conversationId = '593b4f9d-a3cf-420d-997c-f0e2d17688c6'

  it('reads the route context exclusively from the submitted form', () => {
    const formData = new FormData()
    formData.set('tenantId', tenantId)
    formData.set('conversationId', conversationId)
    formData.set('locale', 'en')

    expect(parseInstagramActionContext(formData)).toMatchObject({
      success: true,
      data: { tenantId, conversationId, locale: 'en' },
    })
  })

  it('rejects a missing or malformed route context', () => {
    const formData = new FormData()
    formData.set('tenantId', tenantId)
    formData.set('conversationId', 'stale-conversation')

    expect(parseInstagramActionContext(formData).success).toBe(false)
  })
})
