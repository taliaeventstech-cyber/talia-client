import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { auditInsert, rpc, processJobs } = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  rpc: vi.fn(),
  processJobs: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== 'audit_events') throw new Error(`Unexpected table: ${table}`)
      return { insert: auditInsert }
    },
    rpc,
  }),
}))
vi.mock('@/lib/instagram/processor', () => ({ processInstagramInboundJobs: processJobs }))
vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: (callback: () => unknown) => callback(),
}))

import { GET, POST } from './route'

const originalVerifyToken = process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN
const originalAppSecret = process.env.META_INSTAGRAM_APP_SECRET

afterEach(() => {
  restoreEnvironment('META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN', originalVerifyToken)
  restoreEnvironment('META_INSTAGRAM_APP_SECRET', originalAppSecret)
})

beforeEach(() => {
  auditInsert.mockReset()
  auditInsert.mockResolvedValue({ error: null })
  rpc.mockReset()
  rpc.mockResolvedValue({ data: [{ outcome: 'accepted' }], error: null })
  processJobs.mockReset()
  processJobs.mockResolvedValue({
    claimed: 1, responded: 1, handoffs: 0, retried: 0, deferred: 0, failed: 0,
  })
})

describe('Meta Instagram webhook route', () => {
  it('answers Meta verification with the raw challenge', async () => {
    process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'verify-token'
    const response = GET(new Request(
      'https://agora.talia.events/api/webhooks/meta/instagram?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123456',
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    await expect(response.text()).resolves.toBe('123456')
  })

  it('rejects an invalid verification token', async () => {
    process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'verify-token'
    const response = GET(new Request(
      'https://agora.talia.events/api/webhooks/meta/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456',
    ))

    expect(response.status).toBe(403)
  })

  it('accepts a signed Instagram text notification', async () => {
    process.env.META_INSTAGRAM_APP_SECRET = 'instagram-app-secret'
    const payload = validEnvelope()
    const response = await POST(signedRequest(payload, 'instagram-app-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(rpc).toHaveBeenCalledWith('ingest_instagram_message', expect.objectContaining({
      p_instagram_user_id: 'professional-account-1',
      p_sender_igsid: 'instagram-scoped-user-1',
      p_provider_message_id: 'instagram-message-1',
    }))
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'instagram.webhook_diagnostic',
      target_type: 'instagram_webhook',
      metadata: expect.objectContaining({
        stage: 'processed',
        entry_count: 1,
        messaging_event_count: 1,
        accepted: 1,
      }),
    }))
    expect(JSON.stringify(auditInsert.mock.calls)).not.toContain('Hello')
    expect(JSON.stringify(auditInsert.mock.calls)).not.toContain('instagram-scoped-user-1')
    await vi.waitFor(() => expect(processJobs).toHaveBeenCalledWith(expect.anything(), { limit: 3 }))
  })

  it('records only bounded metadata when a signed payload has an unknown shape', async () => {
    process.env.META_INSTAGRAM_APP_SECRET = 'instagram-app-secret'
    const payload = JSON.stringify({ object: 'instagram', secret_message: 'do not persist' })

    const response = await POST(signedRequest(payload, 'instagram-app-secret'))

    expect(response.status).toBe(422)
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        stage: 'invalid_envelope',
        payload_size_bytes: Buffer.byteLength(payload),
      },
    }))
    expect(JSON.stringify(auditInsert.mock.calls)).not.toContain('do not persist')
  })

  it('rejects missing or invalid signatures before parsing', async () => {
    process.env.META_INSTAGRAM_APP_SECRET = 'instagram-app-secret'
    const missing = await POST(new Request(
      'https://agora.talia.events/api/webhooks/meta/instagram',
      { method: 'POST', body: validEnvelope() },
    ))
    const invalid = await POST(signedRequest(validEnvelope(), 'wrong-secret'))

    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(auditInsert).not.toHaveBeenCalled()
  })

  it('asks Meta to retry when durable ingestion fails', async () => {
    process.env.META_INSTAGRAM_APP_SECRET = 'instagram-app-secret'
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })

    const response = await POST(signedRequest(validEnvelope(), 'instagram-app-secret'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'instagram_webhook_ingest_failed' })
  })
})

function validEnvelope() {
  return JSON.stringify({
    object: 'instagram',
    entry: [{
      id: 'professional-account-1',
      messaging: [{
        sender: { id: 'instagram-scoped-user-1' },
        recipient: { id: 'professional-account-1' },
        timestamp: 1790053200123,
        message: { mid: 'instagram-message-1', text: 'Hello' },
      }],
    }],
  })
}

function signedRequest(payload: string, secret: string) {
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return new Request('https://agora.talia.events/api/webhooks/meta/instagram', {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': `sha256=${signature}` },
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
