import { describe, expect, it, vi } from 'vitest'
import { deleteKnowledgeSourceData } from './source-deletion'

describe('deleteKnowledgeSourceData', () => {
  it('deletes tenant-scoped structured data, the source and its stored file', async () => {
    const calls: string[] = []
    const remove = vi.fn(async () => ({ error: null }))
    const admin = createAdminMock({
      source: {
        id: 'source-1',
        name: 'Accessibility.pdf',
        type: 'pdf',
        config: {
          storage_bucket: 'knowledge',
          storage_path: 'tenant-1/accessibility.pdf',
        },
      },
      calls,
      remove,
    })

    const result = await deleteKnowledgeSourceData({
      admin: admin as never,
      tenantId: 'tenant-1',
      sourceId: 'source-1',
    })

    expect(result).toEqual({
      ok: true,
      source: {
        id: 'source-1',
        name: 'Accessibility.pdf',
        type: 'pdf',
      },
    })
    expect(calls).toEqual([
      'knowledge_sources:select:id=source-1:theatre_id=tenant-1',
      'knowledge_items:delete:source_id=source-1:theatre_id=tenant-1',
      'knowledge_sources:delete:id=source-1:theatre_id=tenant-1',
    ])
    expect(remove).toHaveBeenCalledWith(['tenant-1/accessibility.pdf'])
  })

  it('stops without deleting when the source does not belong to the tenant', async () => {
    const calls: string[] = []
    const admin = createAdminMock({ source: null, calls })

    const result = await deleteKnowledgeSourceData({
      admin: admin as never,
      tenantId: 'tenant-2',
      sourceId: 'source-1',
    })

    expect(result).toEqual({ ok: false, error: 'Fuente no encontrada.' })
    expect(calls).toEqual([
      'knowledge_sources:select:id=source-1:theatre_id=tenant-2',
    ])
  })
})

function createAdminMock({
  source,
  calls,
  remove = vi.fn(async () => ({ error: null })),
}: {
  source: {
    id: string
    name: string
    type: string
    config: Record<string, unknown>
  } | null
  calls: string[]
  remove?: ReturnType<typeof vi.fn>
}) {
  return {
    from(table: string) {
      const filters: string[] = []
      let operation = 'select'
      const query = {
        select() {
          operation = 'select'
          return query
        },
        delete() {
          operation = 'delete'
          return query
        },
        eq(column: string, value: string) {
          filters.push(`${column}=${value}`)
          return query
        },
        async maybeSingle() {
          calls.push(`${table}:${operation}:${filters.join(':')}`)
          return { data: source, error: null }
        },
        then(resolve: (value: { error: null }) => unknown) {
          calls.push(`${table}:${operation}:${filters.join(':')}`)
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return query
    },
    storage: {
      from() {
        return { remove }
      },
    },
  }
}
