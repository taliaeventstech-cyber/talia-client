import {
  parseMetaWebhookEnvelope,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from '@/lib/whatsapp/meta-webhook'
import { ingestMetaWhatsappEnvelope } from '@/lib/whatsapp/inbound'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export function GET(request: Request) {
  const verifyToken = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    return Response.json({ error: 'meta_webhook_verify_token_missing' }, { status: 503 })
  }

  const searchParams = new URL(request.url).searchParams
  const challenge = verifyMetaWebhookChallenge({
    mode: searchParams.get('hub.mode'),
    token: searchParams.get('hub.verify_token'),
    challenge: searchParams.get('hub.challenge'),
    expectedToken: verifyToken,
  })

  if (!challenge) {
    return Response.json({ error: 'invalid_webhook_verification' }, { status: 403 })
  }

  return new Response(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    return Response.json({ error: 'meta_app_secret_missing' }, { status: 503 })
  }

  const payload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature({ payload, signature, appSecret })) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const envelope = parseMetaWebhookEnvelope(payload)
  if (!envelope) {
    return Response.json({ error: 'invalid_whatsapp_webhook' }, { status: 422 })
  }

  try {
    const summary = await ingestMetaWhatsappEnvelope(createAdminClient(), envelope)
    if (summary.unmatched > 0) {
      console.warn(JSON.stringify({
        event: 'whatsapp_webhook_unmatched_connection',
        unmatched_count: summary.unmatched,
      }))
    }
  } catch {
    console.error(JSON.stringify({
      event: 'whatsapp_webhook_ingest_failed',
      error_code: 'durable_ingest_failed',
    }))
    return Response.json({ error: 'whatsapp_webhook_ingest_failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}
