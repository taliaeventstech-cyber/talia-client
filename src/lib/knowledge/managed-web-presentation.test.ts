import { describe, expect, it } from 'vitest'
import { getManagedWebPresentation, type ManagedWebRunSummary } from './managed-web-presentation'

const successfulRun: ManagedWebRunSummary = {
  status: 'succeeded',
  checked_count: 1,
  changed_count: 1,
  unchanged_count: 0,
  failed_count: 0,
  blocked_count: 0,
  error_code: null,
}

describe('managed web source presentation', () => {
  it('does not hide an incomplete discovery behind a ready source status', () => {
    const result = getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'ready',
      run: { ...successfulRun, status: 'partial', error_code: 'discovery_incomplete' },
    })

    expect(result).toEqual({
      outcome: 'partial_discovery',
      tone: 'warning',
      actions: ['retry', 'widget', 'support'],
    })
  })

  it('distinguishes a successful unchanged refresh', () => {
    expect(getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'ready',
      run: { ...successfulRun, changed_count: 0, unchanged_count: 1 },
    }).outcome).toBe('unchanged')
  })

  it('maps blocked failures to widget and support actions', () => {
    const result = getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'error',
      run: { ...successfulRun, status: 'failed', changed_count: 0, blocked_count: 1 },
    })

    expect(result).toMatchObject({ outcome: 'blocked', actions: ['retry', 'widget', 'support'] })
  })

  it('makes a robots.txt denial explicit without suggesting a blind retry', () => {
    const result = getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'error',
      run: {
        ...successfulRun,
        status: 'failed',
        changed_count: 0,
        error_code: 'robots_disallowed',
      },
    })

    expect(result).toEqual({
      outcome: 'robots_blocked',
      tone: 'danger',
      actions: ['widget', 'support'],
    })
  })

  it('does not offer a retry while the source is paused', () => {
    expect(getManagedWebPresentation({
      syncEnabled: false,
      sourceStatus: 'ready',
      run: successfulRun,
    })).toEqual({ outcome: 'paused', tone: 'neutral', actions: [] })
  })

  it('does not call a source updated while its embeddings are still pending', () => {
    expect(getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'ready',
      run: successfulRun,
      embeddingCounts: {
        ready: 4,
        pending: 3,
        processing: 1,
        error: 0,
      },
    })).toEqual({ outcome: 'preparing', tone: 'neutral', actions: [] })
  })

  it('makes embedding failures actionable after a successful crawl', () => {
    expect(getManagedWebPresentation({
      syncEnabled: true,
      sourceStatus: 'ready',
      run: successfulRun,
      embeddingCounts: {
        ready: 4,
        pending: 0,
        processing: 0,
        error: 2,
      },
    })).toEqual({ outcome: 'embedding_error', tone: 'danger', actions: ['retry_embeddings'] })
  })
})
