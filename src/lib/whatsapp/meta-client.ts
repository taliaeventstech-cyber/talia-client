import { z } from 'zod'

const successResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1).max(300) })).min(1),
})

export type MetaWhatsappSendResult =
  | { ok: true; providerMessageId: string }
  | {
      ok: false
      outcome: 'transient_rejection' | 'definitive_rejection' | 'uncertain'
      status: number | null
      errorCode: string
    }

export async function sendMetaWhatsappText(
  input: {
    phoneNumberId: string
    recipientWaId: string
    body: string
    replyToProviderMessageId: string
  },
  options: {
    fetcher?: typeof fetch
    accessToken?: string
    graphApiVersion?: string
    timeoutMs?: number
  } = {},
): Promise<MetaWhatsappSendResult> {
  const accessToken = options.accessToken ?? process.env.META_WHATSAPP_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: false, outcome: 'definitive_rejection', status: null, errorCode: 'meta_access_token_missing' }
  }

  const version = normalizeGraphApiVersion(options.graphApiVersion ?? process.env.META_WHATSAPP_GRAPH_API_VERSION)
  const fetcher = options.fetcher ?? fetch
  try {
    const response = await fetcher(
      `https://graph.facebook.com/${version}/${encodeURIComponent(input.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.recipientWaId,
          context: { message_id: input.replyToProviderMessageId },
          type: 'text',
          text: { preview_url: false, body: input.body },
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      },
    )

    if (!response.ok) {
      return {
        ok: false,
        outcome: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
          ? 'transient_rejection'
          : 'definitive_rejection',
        status: response.status,
        errorCode: `meta_http_${response.status}`,
      }
    }

    const parsed = successResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      return { ok: false, outcome: 'uncertain', status: response.status, errorCode: 'meta_invalid_success_response' }
    }

    return { ok: true, providerMessageId: parsed.data.messages[0].id }
  } catch {
    return { ok: false, outcome: 'uncertain', status: null, errorCode: 'meta_network_outcome_unknown' }
  }
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
