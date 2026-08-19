import { describe, expect, it } from 'vitest'
import { parseMetaEmbeddedSignupMessage } from './embedded-signup-message'

describe('Meta Embedded Signup browser messages', () => {
  it('accepts a completed session only from a real Facebook HTTPS origin', () => {
    const payload = JSON.stringify({
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: { business_id: 'business-1', waba_id: 'waba-1', phone_number_id: 'phone-1' },
    })

    expect(parseMetaEmbeddedSignupMessage('https://www.facebook.com', payload)).toEqual({
      kind: 'finished',
      businessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
    })
    expect(parseMetaEmbeddedSignupMessage('https://evilfacebook.com', payload)).toBeNull()
    expect(parseMetaEmbeddedSignupMessage('http://www.facebook.com', payload)).toBeNull()
  })

  it('normalizes cancellation and provider failures', () => {
    expect(parseMetaEmbeddedSignupMessage('https://web.facebook.com', JSON.stringify({
      type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {},
    }))).toEqual({ kind: 'cancelled' })
    expect(parseMetaEmbeddedSignupMessage('https://web.facebook.com', JSON.stringify({
      type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR', data: {},
    }))).toEqual({ kind: 'error' })
  })
})
