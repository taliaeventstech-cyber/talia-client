// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { shouldReuseWebSnapshot } from './ingestion'

describe('automatic widget snapshot ingestion', () => {
  it('evaluates existing unchanged snapshots once after programme extraction is enabled', () => {
    const contentHash = 'same-content'
    const legacyConfig = { content_hash: contentHash, chunk_count: 4 }

    expect(shouldReuseWebSnapshot({
      status: 'ready',
      config: legacyConfig,
      contentHash,
      captureMode: 'automatic',
    })).toBe(false)

    expect(shouldReuseWebSnapshot({
      status: 'ready',
      config: {
        ...legacyConfig,
        programme_extraction_evaluated_hash: contentHash,
      },
      contentHash,
      captureMode: 'automatic',
    })).toBe(true)
  })

  it('keeps manual captures on the existing content-hash fast path', () => {
    expect(shouldReuseWebSnapshot({
      status: 'ready',
      config: { content_hash: 'same-content' },
      contentHash: 'same-content',
      captureMode: 'manual',
    })).toBe(true)
  })
})
