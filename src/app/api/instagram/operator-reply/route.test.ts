import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/instagram/operator-reply', () => {
  it('rejects malformed request context before authentication or sending', async () => {
    const response = await POST(new Request('http://localhost/api/instagram/operator-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'not-a-tenant',
        conversationId: 'not-a-conversation',
        body: '',
        idempotencyKey: 'not-a-key',
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      outcome: 'invalid_request',
      errorCode: 'IG_REPLY_INVALID_REQUEST',
    })
  })
})
