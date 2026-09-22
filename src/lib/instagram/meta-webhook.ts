import { z } from 'zod'

const instagramMessageSchema = z.object({
  mid: z.string().min(1).max(1_000),
  text: z.string().optional(),
  attachments: z.array(z.object({
    type: z.string().min(1).max(100),
  }).passthrough()).optional(),
  is_deleted: z.boolean().optional(),
  is_echo: z.boolean().optional(),
  is_self: z.boolean().optional(),
  is_unsupported: z.boolean().optional(),
  quick_reply: z.object({ payload: z.string().optional() }).passthrough().optional(),
  reply_to: z.object({ mid: z.string().min(1).max(1_000).optional() }).passthrough().optional(),
}).passthrough()

const instagramEnvelopeSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(z.object({
    id: z.string().min(1).max(200),
    time: z.number().int().nonnegative().optional(),
    messaging: z.array(z.object({
      sender: z.object({ id: z.string().min(1).max(200) }).passthrough(),
      recipient: z.object({ id: z.string().min(1).max(200) }).passthrough(),
      timestamp: z.number().int().nonnegative().optional(),
      message: instagramMessageSchema.optional(),
    }).passthrough()).optional(),
  }).passthrough()),
}).passthrough()

export type MetaInstagramWebhookEnvelope = z.infer<typeof instagramEnvelopeSchema>

export type MetaInstagramInboundMessage = {
  instagramUserId: string
  senderInstagramScopedId: string
  providerMessageId: string
  messageType: string
  bodyText: string | null
  providerTimestamp: string | null
  contextProviderMessageId: string | null
  processable: boolean
  metadata: {
    hasAttachments: boolean
    hasReplyContext: boolean
    isUnsupported: boolean
  }
}

export function parseMetaInstagramWebhookEnvelope(
  payload: string,
): MetaInstagramWebhookEnvelope | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }

  if (Array.isArray(parsed)) {
    const envelopes = z.array(instagramEnvelopeSchema).min(1).max(10).safeParse(parsed)
    if (!envelopes.success) return null
    return {
      object: 'instagram',
      entry: envelopes.data.flatMap((envelope) => envelope.entry),
    }
  }

  const envelope = instagramEnvelopeSchema.safeParse(parsed)
  return envelope.success ? envelope.data : null
}

export function extractMetaInstagramInboundMessages(
  envelope: MetaInstagramWebhookEnvelope,
): MetaInstagramInboundMessage[] {
  const inbound: MetaInstagramInboundMessage[] = []

  for (const entry of envelope.entry) {
    for (const event of entry.messaging ?? []) {
      const message = event.message
      if (!message) continue
      if (event.recipient.id !== entry.id || event.sender.id === entry.id) continue
      if (message.is_echo || message.is_self || message.is_deleted) continue

      const bodyText = cleanOptionalText(message.text, 16_000)
      const hasAttachments = Boolean(message.attachments?.length)
      const messageType = normalizeMessageType(message, bodyText, hasAttachments)
      const processable = messageType === 'text' && bodyText !== null

      inbound.push({
        instagramUserId: entry.id,
        senderInstagramScopedId: event.sender.id,
        providerMessageId: message.mid,
        messageType,
        bodyText: processable ? bodyText : null,
        providerTimestamp: parseInstagramTimestamp(event.timestamp),
        contextProviderMessageId: message.reply_to?.mid ?? null,
        processable,
        metadata: {
          hasAttachments,
          hasReplyContext: Boolean(message.reply_to?.mid),
          isUnsupported: Boolean(message.is_unsupported),
        },
      })
    }
  }

  return inbound
}

function normalizeMessageType(
  message: z.infer<typeof instagramMessageSchema>,
  bodyText: string | null,
  hasAttachments: boolean,
) {
  if (message.is_unsupported) return 'unsupported'
  if (hasAttachments) return cleanOptionalText(message.attachments?.[0]?.type, 100) ?? 'attachment'
  if (bodyText !== null) return 'text'
  return 'unknown'
}

function cleanOptionalText(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function parseInstagramTimestamp(value: number | undefined) {
  if (value === undefined || !Number.isSafeInteger(value)) return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}
