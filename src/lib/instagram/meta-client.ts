import { z } from 'zod'

const successResponseSchema = z.object({
  recipient_id: z.string().min(1).max(300),
  message_id: z.string().min(1).max(1_000),
})

export type MetaInstagramSendResult =
  | { ok: true; providerMessageId: string }
  | {
      ok: false
      outcome: 'transient_rejection' | 'definitive_rejection' | 'uncertain'
      status: number | null
      errorCode: string
    }

export async function sendMetaInstagramText(
  input: {
    instagramUserId: string
    recipientInstagramScopedId: string
    body: string
    messagingType?: 'response' | 'human_agent'
  },
  options: {
    fetcher?: typeof fetch
    accessToken?: string
    graphApiVersion?: string
    timeoutMs?: number
  } = {},
): Promise<MetaInstagramSendResult> {
  const accessToken = options.accessToken
  if (!accessToken) {
    return { ok: false, outcome: 'definitive_rejection', status: null, errorCode: 'instagram_access_token_missing' }
  }

  const version = normalizeGraphApiVersion(
    options.graphApiVersion ?? process.env.META_INSTAGRAM_GRAPH_API_VERSION,
  )
  const fetcher = options.fetcher ?? fetch
  try {
    const response = await fetcher(
      `https://graph.instagram.com/${version}/${encodeURIComponent(input.instagramUserId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: input.recipientInstagramScopedId },
          message: { text: input.body },
          ...(input.messagingType === 'human_agent'
            ? { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' }
            : input.messagingType === 'response'
              ? { messaging_type: 'RESPONSE' }
              : {}),
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
        errorCode: `meta_instagram_http_${response.status}`,
      }
    }

    const parsed = successResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      return {
        ok: false,
        outcome: 'uncertain',
        status: response.status,
        errorCode: 'meta_instagram_invalid_success_response',
      }
    }
    return { ok: true, providerMessageId: parsed.data.message_id }
  } catch {
    return {
      ok: false,
      outcome: 'uncertain',
      status: null,
      errorCode: 'meta_instagram_network_outcome_unknown',
    }
  }
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
