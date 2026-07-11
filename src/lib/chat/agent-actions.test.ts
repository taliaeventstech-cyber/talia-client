import { describe, expect, it } from 'vitest'
import { summarizeVerifiedChatActions } from './agent-actions'

describe('summarizeVerifiedChatActions', () => {
  const config = {
    fallbackPhone: '+34 600 123 456',
    whatsappEnabled: true,
  }

  it('rebuilds a verified WhatsApp action from tenant configuration', () => {
    expect(summarizeVerifiedChatActions([{
      type: 'whatsapp',
      label: 'Untrusted label',
      href: 'https://wa.me/34600123456',
    }], config)).toEqual([{
      type: 'whatsapp',
      label: '+34 600 123 456',
      href: 'https://wa.me/34600123456',
    }])
  })

  it('rejects unexpected destinations and disabled WhatsApp', () => {
    expect(summarizeVerifiedChatActions([{
      type: 'whatsapp',
      label: '+34 600 123 456',
      href: 'https://example.com/redirect',
    }], config)).toEqual([])
    expect(summarizeVerifiedChatActions([{
      type: 'whatsapp',
      label: '+34 600 123 456',
      href: 'https://wa.me/34600123456',
    }], { ...config, whatsappEnabled: false })).toEqual([])
  })
})
