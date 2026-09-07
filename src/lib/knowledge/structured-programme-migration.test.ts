import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260907120000_structured_programme_knowledge.sql'),
  'utf8',
)

describe('structured programme knowledge migration', () => {
  it('keeps extracted events tenant and source scoped', () => {
    expect(migration).toContain('create table if not exists public.programme_events')
    expect(migration).toContain('programme_events_document_source_theatre_fkey')
    expect(migration).toContain('references public.knowledge_documents(id, source_id, theatre_id)')
    expect(migration).toContain('alter table public.programme_events enable row level security')
  })

  it('replaces one document extraction atomically and exposes only service-role writes', () => {
    expect(migration).toContain('function public.replace_programme_events')
    expect(migration).toContain('delete from public.programme_events')
    expect(migration).toContain('grant execute on function public.replace_programme_events')
    expect(migration).toContain('to service_role')
  })

  it('excludes expired events by default without destroying historical knowledge', () => {
    expect(migration).toContain('p_include_expired boolean default false')
    expect(migration).toContain('event.valid_until >= p_reference_date')
    expect(migration).toContain('programme_knowledge_lifecycle_candidates')
    expect(migration).not.toContain('delete from public.programme_events where valid_until')
  })
})
