// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { normalizeSingleEmailAddress } from './email-address'

describe('normalizeSingleEmailAddress', () => {
  it('normalizes one ordinary mailbox address', () => {
    expect(normalizeSingleEmailAddress(' Visitor+Tickets@Example.COM '))
      .toBe('visitor+tickets@example.com')
  })

  it.each([
    'victim@example.com, attacker@example.com',
    'victim@example.com;attacker@example.com',
    'victim@example.com\r\nBcc: attacker@example.com',
    'Display Name <victim@example.com>',
    'missing-domain@',
  ])('rejects unsafe or non-single recipient input: %s', (value) => {
    expect(normalizeSingleEmailAddress(value)).toBeNull()
  })
})
