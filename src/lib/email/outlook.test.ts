// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { parseOutlookMessage } from './outlook'

describe('parseOutlookMessage', () => {
  it('normalizes Microsoft Graph messages into the shared email shape', () => {
    const parsed = parseOutlookMessage({
      id: 'msg_1',
      conversationId: 'conv_1',
      subject: 'Consulta de entradas',
      from: {
        emailAddress: {
          name: 'Cliente',
          address: 'CLIENTE@EXAMPLE.COM',
        },
      },
      toRecipients: [
        { emailAddress: { address: 'info@venue.test' } },
      ],
      ccRecipients: [],
      body: {
        contentType: 'text',
        content: 'Hola, queria informacion sobre entradas.',
      },
      bodyPreview: 'Hola, queria informacion...',
      receivedDateTime: '2026-05-16T10:00:00Z',
      internetMessageHeaders: [
        { name: 'Auto-Submitted', value: 'no' },
      ],
    })

    expect(parsed).toMatchObject({
      id: 'msg_1',
      threadId: 'conv_1',
      subject: 'Consulta de entradas',
      fromEmail: 'cliente@example.com',
      fromName: 'Cliente',
      toEmails: ['info@venue.test'],
      bodyText: 'Hola, queria informacion sobre entradas.',
      receivedAt: '2026-05-16T10:00:00Z',
      headers: {
        'auto-submitted': 'no',
      },
    })
  })
})
