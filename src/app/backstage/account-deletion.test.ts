import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('backstage account deletion schema', () => {
  it('cascades legacy conversation topics when their venue is deleted', async () => {
    const migration = await readFile(
      resolve(
        process.cwd(),
        'supabase/migrations/20260802200000_fix_account_deletion_cascade.sql',
      ),
      'utf8',
    )

    expect(migration).toContain(
      'drop constraint if exists conversation_topics_theatre_id_fkey',
    )
    expect(migration).toContain(
      'foreign key (theatre_id) references public.theatres(id) on delete cascade',
    )
  })
})
