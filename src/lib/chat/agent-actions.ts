import { normalizeInternationalPhoneValue } from '@/lib/phone/international'

export type PublicChatAction =
  | {
    type: 'whatsapp'
    label: string
    href: string
  }
  | {
    type: 'location'
    label: string
    address: string
    href: string
    embed_href: string
  }

export function summarizeVerifiedChatActions(
  value: unknown,
  config: {
    tenantName: string
    fallbackPhone: string | null
    whatsappEnabled: boolean
  },
): PublicChatAction[] {
  if (!Array.isArray(value)) return []

  const actions: PublicChatAction[] = []
  const whatsapp = buildVerifiedWhatsappAction(value, config)
  if (whatsapp) actions.push(whatsapp)
  const location = buildVerifiedLocationAction(value, config.tenantName)
  if (location) actions.push(location)
  return actions
}

function buildVerifiedWhatsappAction(
  value: unknown[],
  config: {
    fallbackPhone: string | null
    whatsappEnabled: boolean
  },
): PublicChatAction | null {
  if (!config.whatsappEnabled || !config.fallbackPhone) return null
  const canonicalPhone = normalizeInternationalPhoneValue(config.fallbackPhone)
  if (!canonicalPhone) return null

  const expectedHref = `https://wa.me/${canonicalPhone.slice(1)}`
  const hasVerifiedWhatsappAction = value.some((action) => (
    isRecord(action)
    && action.type === 'whatsapp'
    && action.href === expectedHref
  ))

  return hasVerifiedWhatsappAction
    ? { type: 'whatsapp', label: config.fallbackPhone, href: expectedHref }
    : null
}

function buildVerifiedLocationAction(
  value: unknown[],
  tenantName: string,
): PublicChatAction | null {
  const expectedLabel = tenantName.trim().slice(0, 120)
  if (!expectedLabel) return null

  for (const action of value) {
    if (!isRecord(action) || action.type !== 'location') continue
    if (action.label !== expectedLabel || typeof action.address !== 'string') continue
    if (typeof action.href !== 'string' || typeof action.embed_href !== 'string') continue

    const address = action.address.trim().replace(/\s+/g, ' ')
    if (address.length < 5 || address.length > 300 || /[\r\n<>]/.test(address)) continue
    const encodedAddress = encodeURIComponent(address)
    const expectedHref = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
    const expectedEmbedHref = `https://www.google.com/maps?q=${encodedAddress}&output=embed`
    if (action.href !== expectedHref || action.embed_href !== expectedEmbedHref) continue

    return {
      type: 'location',
      label: expectedLabel,
      address,
      href: expectedHref,
      embed_href: expectedEmbedHref,
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
