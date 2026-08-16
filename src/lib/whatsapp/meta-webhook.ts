import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const metaWebhookEnvelopeSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    id: z.string().min(1),
    changes: z.array(z.object({
      field: z.string().min(1),
      value: z.record(z.string(), z.unknown()),
    }).passthrough()),
  }).passthrough()),
}).passthrough()

export type MetaWebhookEnvelope = z.infer<typeof metaWebhookEnvelopeSchema>

const whatsappMessagesValueSchema = z.object({
  metadata: z.object({
    phone_number_id: z.string().min(1),
  }).passthrough(),
  contacts: z.array(z.object({
    wa_id: z.string().min(1),
    profile: z.object({
      name: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough()).optional(),
  messages: z.array(z.object({
    id: z.string().min(1),
    from: z.string().min(1),
    timestamp: z.string().optional(),
    type: z.string().min(1),
    text: z.object({ body: z.string() }).passthrough().optional(),
    context: z.object({ id: z.string().min(1) }).passthrough().optional(),
  }).passthrough()).optional(),
}).passthrough()

export type MetaWhatsappInboundMessage = {
  wabaId: string
  phoneNumberId: string
  providerMessageId: string
  senderWaId: string
  profileName: string | null
  messageType: string
  bodyText: string | null
  providerTimestamp: string | null
  contextProviderMessageId: string | null
  processable: boolean
  metadata: {
    hasContext: boolean
  }
}

export function verifyMetaWebhookChallenge(input: {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedToken: string
}): string | null {
  if (
    input.mode !== 'subscribe'
    || !input.token
    || !input.challenge
    || !safeEqual(input.token, input.expectedToken)
  ) {
    return null
  }

  return input.challenge
}

export function verifyMetaWebhookSignature(input: {
  payload: string
  signature: string | null
  appSecret: string
}): boolean {
  if (!input.signature?.startsWith('sha256=')) return false

  const receivedHex = input.signature.slice('sha256='.length)
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false

  const expectedHex = createHmac('sha256', input.appSecret)
    .update(input.payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(expectedHex, 'hex'),
    Buffer.from(receivedHex, 'hex'),
  )
}

export function parseMetaWebhookEnvelope(payload: string): MetaWebhookEnvelope | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }

  const result = metaWebhookEnvelopeSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export function extractMetaWhatsappInboundMessages(
  envelope: MetaWebhookEnvelope,
): MetaWhatsappInboundMessage[] {
  const inboundMessages: MetaWhatsappInboundMessage[] = []

  for (const entry of envelope.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue

      const parsedValue = whatsappMessagesValueSchema.safeParse(change.value)
      if (!parsedValue.success || !parsedValue.data.messages?.length) continue

      const contactsByWaId = new Map(
        (parsedValue.data.contacts ?? []).map((contact) => [
          contact.wa_id,
          cleanOptionalText(contact.profile?.name, 300),
        ]),
      )

      for (const message of parsedValue.data.messages) {
        const bodyText = message.type === 'text'
          ? cleanOptionalText(message.text?.body, 16000)
          : null

        inboundMessages.push({
          wabaId: entry.id,
          phoneNumberId: parsedValue.data.metadata.phone_number_id,
          providerMessageId: message.id,
          senderWaId: message.from,
          profileName: contactsByWaId.get(message.from) ?? null,
          messageType: message.type,
          bodyText,
          providerTimestamp: parseMetaTimestamp(message.timestamp),
          contextProviderMessageId: message.context?.id ?? null,
          processable: message.type === 'text' && bodyText !== null,
          metadata: {
            hasContext: Boolean(message.context?.id),
          },
        })
      }
    }
  }

  return inboundMessages
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  if (leftBytes.length !== rightBytes.length) return false
  return timingSafeEqual(leftBytes, rightBytes)
}

function cleanOptionalText(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function parseMetaTimestamp(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null

  const milliseconds = Number(value) * 1000
  if (!Number.isSafeInteger(milliseconds)) return null

  const timestamp = new Date(milliseconds)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}
