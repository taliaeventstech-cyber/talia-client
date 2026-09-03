import { describe, expect, it } from 'vitest'
import { getWhatsappOperatorControlsCopy } from './whatsapp-handoff-copy'

describe('WhatsApp operator controls copy', () => {
  it('contains only values that can cross the Server Component boundary', () => {
    expect(() => structuredClone(getWhatsappOperatorControlsCopy('es'))).not.toThrow()
  })

  it('describes manual reply as an explicit choice before opening the composer', () => {
    expect(getWhatsappOperatorControlsCopy('es').reply).toBe('Contestar de forma manual')
  })
})
