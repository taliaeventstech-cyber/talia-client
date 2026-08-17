import { describe, expect, it } from 'vitest'
import { getWhatsappOperatorControlsCopy } from './whatsapp-handoff-copy'

describe('WhatsApp operator controls copy', () => {
  it('contains only values that can cross the Server Component boundary', () => {
    expect(() => structuredClone(getWhatsappOperatorControlsCopy('es'))).not.toThrow()
  })
})
