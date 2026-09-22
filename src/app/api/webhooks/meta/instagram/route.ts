import { ingestMetaInstagramEnvelope } from '@/lib/instagram/inbound'
import { parseMetaInstagramWebhookEnvelope } from '@/lib/instagram/meta-webhook'
import { processInstagramInboundJobs } from '@/lib/instagram/processor'
import { createHash } from 'node:crypto'
import {
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from '@/lib/meta/webhook-security'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { after } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export function GET(request: Request) {
  const verifyToken = process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    return Response.json({ error: 'instagram_webhook_verify_token_missing' }, { status: 503 })
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
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET
  if (!appSecret) {
    return Response.json({ error: 'instagram_app_secret_missing' }, { status: 503 })
  }

  const payload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature({ payload, signature, appSecret })) {
    console.warn('[DEBUG-ig-webhook-6f2a] Instagram webhook signature rejected')
    return Response.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const admin = createAdminClient()
  const envelope = parseMetaInstagramWebhookEnvelope(payload)
  if (!envelope) {
    await recordWebhookDiagnostic(admin, {
      stage: 'invalid_envelope',
      payload_size_bytes: Buffer.byteLength(payload),
    })
    return Response.json({ error: 'invalid_instagram_webhook' }, { status: 422 })
  }

  try {
    const summary = await ingestMetaInstagramEnvelope(admin, envelope)
    await recordWebhookDiagnostic(admin, {
      stage: 'processed',
      payload_size_bytes: Buffer.byteLength(payload),
      entry_count: envelope.entry.length,
      ...(envelope.entry[0]?.id
        ? { entry_id_sha256: fingerprintIdentifier(envelope.entry[0].id) }
        : {}),
      messaging_event_count: envelope.entry.reduce(
        (total, entry) => total + (entry.messaging?.length ?? 0),
        0,
      ),
      ...summary,
    })
    if (summary.unmatched > 0) {
      console.warn(JSON.stringify({
        event: 'instagram_webhook_unmatched_connection',
        unmatched_count: summary.unmatched,
      }))
    }
    if (summary.accepted > 0) {
      console.info(JSON.stringify({
        event: 'instagram_webhook_messages_queued',
        accepted_count: summary.accepted,
      }))
      try {
        after(async () => {
          try {
            const result = await processInstagramInboundJobs(admin, { limit: 3 })
            console.info(JSON.stringify({ event: 'instagram_webhook_processor_completed', ...result }))
          } catch {
            console.error(JSON.stringify({
              event: 'instagram_webhook_processor_failed',
              error_code: 'processor_wakeup_failed',
            }))
          }
        })
      } catch {
        console.warn(JSON.stringify({
          event: 'instagram_webhook_processor_schedule_failed',
          error_code: 'processor_wakeup_not_scheduled',
        }))
      }
    }
  } catch {
    await recordWebhookDiagnostic(admin, {
      stage: 'ingest_failed',
      payload_size_bytes: Buffer.byteLength(payload),
      entry_count: envelope.entry.length,
      messaging_event_count: envelope.entry.reduce(
        (total, entry) => total + (entry.messaging?.length ?? 0),
        0,
      ),
    })
    console.error(JSON.stringify({
      event: 'instagram_webhook_ingest_failed',
      error_code: 'durable_ingest_failed',
    }))
    return Response.json({ error: 'instagram_webhook_ingest_failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

async function recordWebhookDiagnostic(
  admin: ReturnType<typeof createAdminClient>,
  metadata: Record<string, string | number | boolean>,
) {
  const { error } = await admin.from('audit_events').insert({
    action: 'instagram.webhook_diagnostic',
    target_type: 'instagram_webhook',
    metadata: metadata satisfies Json,
  })

  if (error) {
    console.warn('[DEBUG-ig-webhook-6f2a] Failed to persist Instagram webhook diagnostic')
  }
}

function fingerprintIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
