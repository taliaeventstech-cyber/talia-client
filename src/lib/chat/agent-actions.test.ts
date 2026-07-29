import { describe, expect, it } from 'vitest'
import { summarizeVerifiedChatActions } from './agent-actions'

describe('summarizeVerifiedChatActions', () => {
  const config = {
    tenantName: 'Sala Fènix',
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

  it('accepts a source-verified location only when both Google Maps URLs match the address', () => {
    expect(summarizeVerifiedChatActions([{
      type: 'location',
      label: 'Sala Fènix',
      address: 'Carrer de la Riereta, 31, Barcelona',
      href: 'https://www.google.com/maps/search/?api=1&query=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona',
      embed_href: 'https://www.google.com/maps?q=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona&output=embed',
    }], config)).toEqual([{
      type: 'location',
      label: 'Sala Fènix',
      address: 'Carrer de la Riereta, 31, Barcelona',
      href: 'https://www.google.com/maps/search/?api=1&query=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona',
      embed_href: 'https://www.google.com/maps?q=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona&output=embed',
    }])
  })

  it('rejects tampered or unverified location destinations', () => {
    expect(summarizeVerifiedChatActions([{
      type: 'location',
      label: 'Sala Fènix',
      address: 'Carrer de la Riereta, 31, Barcelona',
      href: 'https://example.com/maps',
      embed_href: 'https://www.google.com/maps?q=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona&output=embed',
    }], config)).toEqual([])

    expect(summarizeVerifiedChatActions([{
      type: 'location',
      label: 'Otra sala',
      address: 'Carrer de la Riereta, 31, Barcelona',
      href: 'https://www.google.com/maps/search/?api=1&query=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona',
      embed_href: 'https://www.google.com/maps?q=Carrer%20de%20la%20Riereta%2C%2031%2C%20Barcelona&output=embed',
    }], config)).toEqual([])
  })

  it('accepts a secure purchase action only with matching verified runtime metadata', () => {
    expect(summarizeVerifiedChatActions([{
      type: 'purchase',
      label: 'Front Zone',
      href: 'https://tickets.example.com/front-zone',
    }], {
      ...config,
      purchaseAction: {
        status: 'verified',
        reason: 'source_backed_purchase_url',
        item_name: 'Front Zone',
        supported_source_id: 'front-zone',
      },
    })).toEqual([{
      type: 'purchase',
      label: 'Front Zone',
      href: 'https://tickets.example.com/front-zone',
    }])
  })

  it('rejects purchase actions without verified metadata or with an unsafe destination', () => {
    const purchaseAction = {
      status: 'verified',
      reason: 'source_backed_purchase_url',
      item_name: 'Front Zone',
      supported_source_id: 'front-zone',
    }
    expect(summarizeVerifiedChatActions([{
      type: 'purchase',
      label: 'Front Zone',
      href: 'https://tickets.example.com/front-zone',
    }], config)).toEqual([])
    expect(summarizeVerifiedChatActions([{
      type: 'purchase',
      label: 'Front Zone',
      href: 'http://tickets.example.com/front-zone',
    }], { ...config, purchaseAction })).toEqual([])
    expect(summarizeVerifiedChatActions([{
      type: 'purchase',
      label: 'Another ticket',
      href: 'https://tickets.example.com/front-zone',
    }], { ...config, purchaseAction })).toEqual([])
  })
})
