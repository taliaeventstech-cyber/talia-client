import { describe, expect, it } from 'vitest'
import type { Database } from '@/types/database.types'
import { buildKnowledgeWebOperationalAlert } from './web-source-alerts'

type AlertRow = Database['public']['Functions']['get_knowledge_web_operational_alerts']['Returns'][number]

const baseRow: AlertRow = {
  alert_key: 'source-failure:source-1',
  current_value: 3,
  error_code: 'http_429',
  kind: 'source_failure_streak',
  latest_status: 'failed',
  limit_value: 3,
  occurred_at: '2026-07-15T09:00:00.000Z',
  ratio: 1,
  severity: 'critical',
  source_id: 'source-1',
  source_name: 'Programación',
  theatre_id: 'tenant-1',
  theatre_name: 'Sala Fènix',
}

describe('managed web operational alerts', () => {
  it('turns failure streak facts into an actionable source alert', () => {
    expect(buildKnowledgeWebOperationalAlert(baseRow)).toMatchObject({
      kind: 'source_failure_streak',
      severity: 'critical',
      title: 'Programación acumula incidencias',
      detail: '3 sincronizaciones consecutivas con incidencias (failed · http_429).',
    })
  })

  it('formats long overdue periods without exposing raw timestamps', () => {
    expect(buildKnowledgeWebOperationalAlert({
      ...baseRow,
      alert_key: 'source-overdue:source-1',
      current_value: 50,
      error_code: null,
      kind: 'source_sync_overdue',
      latest_status: null,
      limit_value: 6,
      ratio: 1,
      severity: 'critical',
    }).detail).toBe('La sincronización programada lleva 2 d 2 h vencida.')
  })

  it('turns quota facts into a percentage with the correct unit', () => {
    expect(buildKnowledgeWebOperationalAlert({
      ...baseRow,
      alert_key: 'quota:tenant-1:document_quota_usage',
      current_value: 425,
      error_code: null,
      kind: 'document_quota_usage',
      latest_status: null,
      limit_value: 500,
      ratio: 0.85,
      severity: 'warning',
      source_id: null,
      source_name: null,
    })).toMatchObject({
      title: 'Cuota de páginas cerca del límite',
      detail: 'Uso: 425 de 500 páginas (85%).',
    })
  })

  it('identifies pressure on the per-source page quota', () => {
    expect(buildKnowledgeWebOperationalAlert({
      ...baseRow,
      alert_key: 'source-page-quota:source-1',
      current_value: 80,
      error_code: null,
      kind: 'source_page_quota_usage',
      latest_status: null,
      limit_value: 100,
      ratio: 0.8,
      severity: 'warning',
    })).toMatchObject({
      title: 'Cuota de páginas de la fuente cerca del límite',
      detail: 'Uso: 80 de 100 páginas (80%).',
    })
  })
})
