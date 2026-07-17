import { describe, expect, it } from 'vitest'
import { canReprocessKnowledgeSourceFromBackstage, getBackstageSyncRunPresentation } from './backstage-sources'

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

describe('getBackstageSyncRunPresentation', () => {
  it('does not surface a stale source error while a newer run is queued', () => {
    expect(getBackstageSyncRunPresentation({
      run: {
        status: 'queued',
        error_code: null,
        error_details: null,
      },
      sourceLastError: 'Managed source discovery did not cover the complete configured scope',
    })).toEqual({
      statusLabel: 'Actualización en cola',
      issue: null,
      issueTone: 'neutral',
      showCounters: false,
    })
  })

  it('humanizes incomplete discovery without repeating its technical detail', () => {
    expect(getBackstageSyncRunPresentation({
      run: {
        status: 'partial',
        error_code: 'discovery_incomplete',
        error_details: 'Managed source discovery did not cover the complete configured scope',
      },
      sourceLastError: 'Managed source discovery did not cover the complete configured scope',
    })).toEqual({
      statusLabel: 'Cobertura parcial',
      issue: 'La fuente conserva contenido disponible, pero la última actualización no pudo confirmar que se revisara toda la web.',
      issueTone: 'warning',
      showCounters: true,
    })
  })
})
