import { describe, expect, it } from 'vitest'
import {
  isProgrammeExtractionEnabled,
  summarizeProgrammeExtractionBySource,
  withProgrammeExtractionEnabled,
} from './programme'

describe('programme extraction source configuration', () => {
  it('is opt-in and preserves unrelated source configuration', () => {
    expect(isProgrammeExtractionEnabled(null)).toBe(false)
    expect(isProgrammeExtractionEnabled({ programme_extraction_enabled: false })).toBe(false)
    expect(isProgrammeExtractionEnabled({ programme_extraction_enabled: true })).toBe(true)

    expect(withProgrammeExtractionEnabled({ max_pages: 10 }, true)).toEqual({
      max_pages: 10,
      programme_extraction_enabled: true,
    })
  })

  it('summarizes extraction health and measured usage by source', () => {
    const summaries = summarizeProgrammeExtractionBySource([
      {
        source_id: 'source-1',
        metadata: {
          programme_extraction: {
            status: 'ready',
            event_count: 2,
            extracted_at: '2026-09-06T10:00:00.000Z',
            usage: {
              model: 'gpt-4o-mini',
              request_count: 1,
              input_tokens: 100,
              output_tokens: 20,
            },
          },
        },
      },
      {
        source_id: 'source-1',
        metadata: {
          programme_extraction: {
            status: 'error',
            event_count: 1,
            extracted_at: '2026-09-07T10:00:00.000Z',
            usage: {
              model: 'gpt-4o-mini',
              request_count: 1,
              input_tokens: 80,
              output_tokens: 10,
            },
          },
        },
      },
    ])

    expect(summaries.get('source-1')).toEqual({
      eventCount: 3,
      extractedDocuments: 2,
      errorDocuments: 1,
      requestCount: 2,
      inputTokens: 180,
      outputTokens: 30,
      lastExtractedAt: '2026-09-07T10:00:00.000Z',
      models: ['gpt-4o-mini'],
    })
  })
})
