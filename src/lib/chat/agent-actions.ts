import { normalizeInternationalPhoneValue } from '@/lib/phone/international'

export type PublicChatAction = {
  type: 'whatsapp'
  label: string
  href: string
}

export function summarizeVerifiedChatActions(
  value: unknown,
  config: {
    fallbackPhone: string | null
    whatsappEnabled: boolean
  },
): PublicChatAction[] {
  if (!config.whatsappEnabled || !Array.isArray(value) || !config.fallbackPhone) return []

  const canonicalPhone = normalizeInternationalPhoneValue(config.fallbackPhone)
  if (!canonicalPhone) return []

  const expectedHref = `https://wa.me/${canonicalPhone.slice(1)}`
  const hasVerifiedWhatsappAction = value.some((action) => (
    isRecord(action)
    && action.type === 'whatsapp'
    && action.href === expectedHref
  ))

  return hasVerifiedWhatsappAction
    ? [{ type: 'whatsapp', label: config.fallbackPhone, href: expectedHref }]
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
