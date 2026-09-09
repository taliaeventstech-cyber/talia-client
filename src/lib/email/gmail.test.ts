// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { parseGmailMessage } from './gmail'

describe('parseGmailMessage', () => {
  it('rejects a From header containing more than one mailbox', () => {
    const parsed = parseGmailMessage({
      id: 'msg_1',
      threadId: 'thread_1',
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'From', value: 'Victim <victim@example.com>, attacker@example.com' },
        ],
        body: { data: Buffer.from('Hello').toString('base64url') },
      },
    })

    expect(parsed.fromEmail).toBeNull()
  })
})
