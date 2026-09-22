import { z } from 'zod'
import {
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from '@/lib/meta/webhook-security'

export { verifyMetaWebhookChallenge, verifyMetaWebhookSignature }

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
  statuses: z.array(z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    timestamp: z.string().optional(),
    conversation: z.object({
      origin: z.object({ type: z.string().optional() }).passthrough().optional(),
    }).passthrough().optional(),
    pricing: z.object({
      billable: z.boolean().optional(),
      pricing_model: z.string().optional(),
      category: z.string().optional(),
      type: z.string().optional(),
    }).passthrough().optional(),
    errors: z.array(z.object({
      code: z.union([z.string(), z.number()]).optional(),
    }).passthrough()).optional(),
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

const supportedDeliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed'] as const)

export type MetaWhatsappDeliveryStatus = {
  wabaId: string
  phoneNumberId: string
  providerMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  providerTimestamp: string | null
  errorCode: string | null
  metadata: {
    billable?: boolean
    conversationOriginType?: string
    pricingCategory?: string
    pricingModel?: string
    pricingType?: string
  }
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

export function extractMetaWhatsappDeliveryStatuses(
  envelope: MetaWebhookEnvelope,
): MetaWhatsappDeliveryStatus[] {
  const deliveryStatuses: MetaWhatsappDeliveryStatus[] = []

  for (const entry of envelope.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue

      const parsedValue = whatsappMessagesValueSchema.safeParse(change.value)
      if (!parsedValue.success) continue

      for (const status of parsedValue.data.statuses ?? []) {
        const normalizedStatus = status.status.toLowerCase()
        if (!isSupportedDeliveryStatus(normalizedStatus)) continue

        const metadata: MetaWhatsappDeliveryStatus['metadata'] = {}
        if (typeof status.pricing?.billable === 'boolean') {
          metadata.billable = status.pricing.billable
        }
        addOptionalMetadata(metadata, 'conversationOriginType', status.conversation?.origin?.type)
        addOptionalMetadata(metadata, 'pricingCategory', status.pricing?.category)
        addOptionalMetadata(metadata, 'pricingModel', status.pricing?.pricing_model)
        addOptionalMetadata(metadata, 'pricingType', status.pricing?.type)

        deliveryStatuses.push({
          wabaId: entry.id,
          phoneNumberId: parsedValue.data.metadata.phone_number_id,
          providerMessageId: status.id,
          status: normalizedStatus,
          providerTimestamp: parseMetaTimestamp(status.timestamp),
          errorCode: cleanOptionalText(
            status.errors?.[0]?.code === undefined ? undefined : String(status.errors[0].code),
            100,
          ),
          metadata,
        })
      }
    }
  }

  return deliveryStatuses
}

function isSupportedDeliveryStatus(value: string): value is MetaWhatsappDeliveryStatus['status'] {
  return supportedDeliveryStatuses.has(value as MetaWhatsappDeliveryStatus['status'])
}

function addOptionalMetadata(
  metadata: MetaWhatsappDeliveryStatus['metadata'],
  key: 'conversationOriginType' | 'pricingCategory' | 'pricingModel' | 'pricingType',
  value: string | undefined,
) {
  const cleaned = cleanOptionalText(value, 100)
  if (cleaned) metadata[key] = cleaned
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
