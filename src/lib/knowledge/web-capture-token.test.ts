// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebCaptureBatchToken,
  createWebCaptureToken,
  verifyWebCaptureBatchToken,
  verifyWebCaptureToken,
} from './web-capture-token'

describe('web capture tokens', () => {
  beforeEach(() => {
    process.env.WEB_CAPTURE_TOKEN_SECRET = 'test-web-capture-secret'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete process.env.WEB_CAPTURE_TOKEN_SECRET
    delete process.env.WEB_CAPTURE_TOKEN_TTL_SECONDS
  })

  it('uses a 24 hour default ttl so capture links survive an open Agora tab', () => {
    const token = createWebCaptureToken({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      url: 'https://example.com/programacion',
    })

    vi.setSystemTime(new Date('2026-06-29T10:30:00Z'))

    expect(verifyWebCaptureToken(token)).toMatchObject({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      url: 'https://example.com/programacion',
    })
  })

  it('allows the default ttl to be configured', () => {
    process.env.WEB_CAPTURE_TOKEN_TTL_SECONDS = '120'
    const token = createWebCaptureToken({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      url: 'https://example.com/programacion',
    })

    vi.setSystemTime(new Date('2026-06-29T10:04:00Z'))

    expect(() => verifyWebCaptureToken(token)).toThrow('expired_capture_token')
  })

  it('signs a batch of installed pages for sequential capture', () => {
    const token = createWebCaptureBatchToken({
      tenantId: 'tenant-1',
      sourceIds: ['source-1', 'source-2'],
    })

    expect(verifyWebCaptureBatchToken(token)).toMatchObject({
      tenantId: 'tenant-1',
      sourceIds: ['source-1', 'source-2'],
    })
  })
})
