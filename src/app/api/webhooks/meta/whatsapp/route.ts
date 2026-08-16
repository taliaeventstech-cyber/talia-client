import {
  parseMetaWebhookEnvelope,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from '@/lib/whatsapp/meta-webhook'
import { ingestMetaWhatsappEnvelope } from '@/lib/whatsapp/inbound'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWhatsappInboundJobs } from '@/lib/whatsapp/processor'
import { after } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

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
    const admin = createAdminClient()
    const summary = await ingestMetaWhatsappEnvelope(admin, envelope)
    if (summary.unmatched > 0) {
      console.warn(JSON.stringify({
        event: 'whatsapp_webhook_unmatched_connection',
        unmatched_count: summary.unmatched,
      }))
    }
    if (summary.accepted > 0) {
      try {
        after(async () => {
          try {
            const result = await processWhatsappInboundJobs(admin, { limit: Math.min(summary.accepted, 3) })
            console.info(JSON.stringify({ event: 'whatsapp_webhook_processor_completed', ...result }))
          } catch {
            console.error(JSON.stringify({
              event: 'whatsapp_webhook_processor_failed',
              error_code: 'processor_wakeup_failed',
            }))
          }
        })
      } catch {
        console.warn(JSON.stringify({
          event: 'whatsapp_webhook_processor_schedule_failed',
          error_code: 'processor_wakeup_not_scheduled',
        }))
      }
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
