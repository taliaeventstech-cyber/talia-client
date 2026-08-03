import { describe, expect, it } from 'vitest'
import { getKnowledgeSyncActivity } from './sync-activity'

const idleEmbeddings = {
  ready: 0,
  pending: 0,
  processing: 0,
  error: 0,
}

describe('knowledge sync activity', () => {
  it('reports a queued run instead of a generic in-progress state', () => {
    expect(getKnowledgeSyncActivity([{
      name: 'Web oficial',
      syncEnabled: true,
      latestSyncRun: {
        status: 'queued',
        discovered_count: 0,
        checked_count: 0,
        metadata: {},
      },
      embeddingCounts: idleEmbeddings,
    }])).toEqual({
      stage: 'queued',
      sourceName: 'Web oficial',
      current: null,
      total: null,
      requiresPolling: true,
    })
  })

  it('exposes the worker phase and page counters while running', () => {
    expect(getKnowledgeSyncActivity([{
      name: 'Agenda',
      syncEnabled: true,
      latestSyncRun: {
        status: 'running',
        discovered_count: 12,
        checked_count: 5,
        metadata: { phase: 'fetching' },
      },
      embeddingCounts: idleEmbeddings,
    }])).toMatchObject({
      stage: 'fetching',
      sourceName: 'Agenda',
      current: 5,
      total: 12,
      requiresPolling: true,
    })
  })

  it('keeps tracking a completed crawl while embeddings are pending', () => {
    expect(getKnowledgeSyncActivity([{
      name: 'Web oficial',
      syncEnabled: true,
      latestSyncRun: {
        status: 'succeeded',
        discovered_count: 7,
        checked_count: 7,
        metadata: { phase: 'finishing' },
      },
      embeddingCounts: {
        ready: 8,
        pending: 14,
        processing: 4,
        error: 0,
      },
    }])).toEqual({
      stage: 'embeddings',
      sourceName: 'Web oficial',
      current: 8,
      total: 26,
      requiresPolling: true,
    })
  })

  it('does not call a paused source active even if an old run remains queued', () => {
    expect(getKnowledgeSyncActivity([{
      name: 'Web oficial',
      syncEnabled: false,
      latestSyncRun: {
        status: 'queued',
        discovered_count: 0,
        checked_count: 0,
        metadata: {},
      },
      embeddingCounts: idleEmbeddings,
    }])).toBeNull()
  })

  it('stops tracking when the run and all embeddings are ready', () => {
    expect(getKnowledgeSyncActivity([{
      name: 'Web oficial',
      syncEnabled: true,
      latestSyncRun: {
        status: 'succeeded',
        discovered_count: 7,
        checked_count: 7,
        metadata: { phase: 'finishing' },
      },
      embeddingCounts: {
        ready: 26,
        pending: 0,
        processing: 0,
        error: 0,
      },
    }])).toBeNull()
  })
})
