// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verifyWebCaptureToken } from './web-capture-token'
import { getSignedCaptureUrl } from './web-capture-url'

describe('getSignedCaptureUrl', () => {
  beforeEach(() => {
    process.env.WEB_CAPTURE_TOKEN_SECRET = 'test-web-capture-secret'
  })

  afterEach(() => {
    delete process.env.WEB_CAPTURE_TOKEN_SECRET
  })

  it('signs the clean landing URL and carries the capture API base separately', () => {
    const captureUrl = getSignedCaptureUrl({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      sourceUrl: 'https://example.com/programa#agenda',
      captureApiBase: 'https://agora.example.test',
    })

    const url = new URL(captureUrl)
    const token = verifyWebCaptureToken(url.searchParams.get('talia_capture_token') ?? '')

    expect(url.hash).toBe('')
    expect(url.searchParams.get('talia_capture_api_base')).toBe('https://agora.example.test')
    expect(token.url).toBe('https://example.com/programa')
  })
})
