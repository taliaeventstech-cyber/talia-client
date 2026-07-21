import { describe, expect, it, vi } from 'vitest'
import {
  createEmailProviderError,
  getSafeEmailErrorCode,
  logSafeEmailError,
} from './safe-error'

describe('safe email errors', () => {
  it('preserves stable provider codes and status values', () => {
    const error = createEmailProviderError('google_token_exchange_failed', 401)
    expect(getSafeEmailErrorCode(error, 'fallback')).toBe('google_token_exchange_failed:401')
  })

  it('replaces unexpected messages that could contain sensitive data', () => {
    const error = new Error('provider body contains access_token=secret')
    expect(getSafeEmailErrorCode(error, 'email_provider_failed')).toBe('email_provider_failed')
  })

  it('logs only the event and sanitized code', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logSafeEmailError(
      'email_provider_request_failed',
      new Error('mailbox user@example.com bearer secret'),
      'email_provider_failed',
    )

    expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
      event: 'email_provider_request_failed',
      error_code: 'email_provider_failed',
    }))
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('user@example.com')
    consoleError.mockRestore()
  })
})
