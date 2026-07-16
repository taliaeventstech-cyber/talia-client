import { describe, expect, it } from 'vitest'
import { canReprocessKnowledgeSourceFromBackstage } from './backstage-sources'

describe('canReprocessKnowledgeSourceFromBackstage', () => {
  it.each(['pdf', 'manual', 'xlsx', 'csv', 'url', 'sitemap', 'website'])(
    'allows supported source type %s',
    (sourceType) => {
      expect(canReprocessKnowledgeSourceFromBackstage(sourceType)).toBe(true)
    },
  )

  it.each(['web_snapshot', 'unknown', 'document_chunk'])(
    'rejects unsupported source type %s',
    (sourceType) => {
      expect(canReprocessKnowledgeSourceFromBackstage(sourceType)).toBe(false)
    },
  )
})
