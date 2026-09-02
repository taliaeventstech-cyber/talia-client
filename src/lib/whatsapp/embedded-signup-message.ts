import { z } from 'zod'

const messageSchema = z.object({
  type: z.literal('WA_EMBEDDED_SIGNUP'),
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
})

export type MetaEmbeddedSignupMessage =
  | {
      kind: 'finished'
      businessId: string
      wabaId: string
      phoneNumberId: string
    }
  | { kind: 'cancelled' }
  | { kind: 'error' }

export function parseMetaEmbeddedSignupMessage(
  origin: string,
  rawData: unknown,
): MetaEmbeddedSignupMessage | null {
  if (!isTrustedMetaOrigin(origin)) return null

  let payload = rawData
  if (typeof rawData === 'string') {
    try {
      payload = JSON.parse(rawData)
    } catch {
      return null
    }
  }

  const parsed = messageSchema.safeParse(payload)
  if (!parsed.success) return null
  if (parsed.data.event === 'CANCEL') return { kind: 'cancelled' }
  if (parsed.data.event === 'ERROR') return { kind: 'error' }
  if (!parsed.data.event.startsWith('FINISH')) return null

  const businessId = getIdentifier(parsed.data.data?.business_id)
  const wabaId = getIdentifier(parsed.data.data?.waba_id)
  const phoneNumberId = getIdentifier(parsed.data.data?.phone_number_id)
  if (!businessId || !wabaId || !phoneNumberId) return { kind: 'error' }

  return { kind: 'finished', businessId, wabaId, phoneNumberId }
}

function isTrustedMetaOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:'
      && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'))
  } catch {
    return false
  }
}

function getIdentifier(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    ? value
    : null
}
