import { describe, expect, it } from 'vitest'
import { getEmailProcessingFailureCode } from './processing-failure'

describe('getEmailProcessingFailureCode', () => {
  it.each([
    ['No connected email mailbox for this tenant', 'mailbox_not_connected'],
    ['No inbound email message found to process', 'inbound_message_not_found'],
    ['Inbound email has no text body to process', 'message_without_readable_content'],
    ['TALIA AI email request failed', 'talia_ai_unavailable'],
    ['Failed to create provider draft', 'provider_draft_failed'],
    ['unknown failure', 'processing_failed'],
  ] as const)('maps %s to a safe code', (error, expected) => {
    expect(getEmailProcessingFailureCode(error)).toBe(expected)
  })
})
