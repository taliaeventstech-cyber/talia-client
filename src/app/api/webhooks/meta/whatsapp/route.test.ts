import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'

const originalVerifyToken = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
const originalAppSecret = process.env.META_APP_SECRET

afterEach(() => {
  restoreEnvironment('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN', originalVerifyToken)
  restoreEnvironment('META_APP_SECRET', originalAppSecret)
})

describe('Meta WhatsApp webhook route', () => {
  it('answers Meta subscription verification with the raw challenge', async () => {
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token'

    const response = GET(new Request(
      'https://agora.talia.events/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123456',
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    await expect(response.text()).resolves.toBe('123456')
  })

  it('rejects an invalid subscription verification token', async () => {
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token'

    const response = GET(new Request(
      'https://agora.talia.events/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456',
    ))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_webhook_verification' })
  })

  it('accepts a signed WhatsApp notification', async () => {
    process.env.META_APP_SECRET = 'app-secret'
    const payload = validEnvelope()

    const response = await POST(signedRequest(payload, 'app-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
  })

  it('rejects missing or invalid signatures before parsing the body', async () => {
    process.env.META_APP_SECRET = 'app-secret'

    const missing = await POST(new Request(
      'https://agora.talia.events/api/webhooks/meta/whatsapp',
      { method: 'POST', body: validEnvelope() },
    ))
    const invalid = await POST(signedRequest(validEnvelope(), 'wrong-secret'))

    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
  })

  it('rejects signed payloads that are not WhatsApp notifications', async () => {
    process.env.META_APP_SECRET = 'app-secret'
    const payload = JSON.stringify({ object: 'page', entry: [] })

    const response = await POST(signedRequest(payload, 'app-secret'))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_whatsapp_webhook' })
  })
})

function validEnvelope() {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: 'phone-1' },
          messages: [{ id: 'message-1', from: '34123456789', type: 'text' }],
        },
      }],
    }],
  })
}

function signedRequest(payload: string, secret: string) {
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return new Request('https://agora.talia.events/api/webhooks/meta/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${signature}`,
    },
    body: payload,
  })
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}
