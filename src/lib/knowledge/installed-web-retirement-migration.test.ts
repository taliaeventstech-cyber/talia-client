// @vitest-environment node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261111183000_retire_stale_installed_web_knowledge.sql'),
  'utf8',
)

describe('installed-web retirement migration', () => {
  it('turns removed documents into durable tombstones without retrievable content', () => {
    expect(migration).toContain('create or replace function public.cleanup_removed_knowledge_document()')
    expect(migration).toContain('delete from public.knowledge_chunks')
    expect(migration).toContain('delete from public.programme_events')
    expect(migration).toContain("new.status = 'removed'")
    expect(migration).toContain('knowledge_documents_cleanup_removed')
  })

  it('retires the stale Sala Fènix page from the captured production trace', () => {
    expect(migration).toContain('2d6e9c5d-5558-43c0-b8c3-5263d161ef60')
    expect(migration).toContain('salafenix.com/constelaciones')
    expect(migration).toContain("'cleanup', 'stale_programme_trace_2026_11_11'")
  })
})
