import { describe, expect, it } from 'vitest'
import { EMAIL_DRAFT_WITH_THREAD_SELECT, EMAIL_MESSAGE_WITH_THREAD_SELECT } from './message-query'

describe('EMAIL_MESSAGE_WITH_THREAD_SELECT', () => {
  it('uses the direct thread foreign key when email table relations are ambiguous', () => {
    expect(EMAIL_MESSAGE_WITH_THREAD_SELECT).toContain(
      'email_threads!email_messages_thread_id_fkey!inner',
    )
  })

  it('uses the direct thread foreign key for prepared email drafts', () => {
    expect(EMAIL_DRAFT_WITH_THREAD_SELECT).toContain(
      'email_threads!email_drafts_thread_id_fkey',
    )
  })
})
