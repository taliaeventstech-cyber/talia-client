import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260930100000_instagram_rollout_reconnect.sql',
)

describe('Instagram rollout reconnect migration', () => {
  it('keeps brand-new connections closed while restoring an approved same-account reconnect', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain("'rollout_approved', true")
    expect(migration).toContain("latest_rollout.action = 'instagram.rollout_enabled'")
    expect(migration).toContain(
      'public.instagram_connections.instagram_user_id = excluded.instagram_user_id',
    )
    expect(migration).toContain(
      "public.instagram_connections.metadata -> 'rollout_approved' = 'true'::jsonb",
    )
    expect(migration).toContain("'connected',\n    false,")
  })

  it('records whether an approved rollout was restored during OAuth', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toContain("'rollout_restored', v_rollout_enabled")
    expect(migration).toContain("'rollout_enabled', v_rollout_enabled")
  })
})
