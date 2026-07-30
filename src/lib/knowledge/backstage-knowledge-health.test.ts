import { describe, expect, it } from 'vitest'
import { buildBackstageKnowledgeHealth } from './backstage-knowledge-health'

describe('buildBackstageKnowledgeHealth', () => {
  it('reports source errors even when no embedding is in error', () => {
    const health = buildBackstageKnowledgeHealth({
      sourceCount: 1_042,
      readySources: 813,
      errorSources: 2,
      totalChunks: 4_096,
      readyChunks: 4_096,
      pendingChunks: 0,
      processingChunks: 0,
      errorChunks: 0,
    })

    expect(health.statusLabel).toBe('revisar')
    expect(health.errorCount).toBe(2)
    expect(health.readinessPercent).toBe(100)
  })

  it('does not turn an unavailable database result into zero knowledge', () => {
    const health = buildBackstageKnowledgeHealth(null)

    expect(health.available).toBe(false)
    expect(health.sourceCount).toBeNull()
    expect(health.statusLabel).toBe('sin datos')
  })
})
