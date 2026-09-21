import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260921150000_instagram_connection_foundation.sql'),
  'utf8',
)

describe('Instagram connection foundation migration', () => {
  it('keeps connections and credentials unavailable to browser database roles', () => {
    expect(migration).toContain('alter table public.instagram_connections enable row level security')
    expect(migration).toContain(
      'revoke all on table public.instagram_connections from public, anon, authenticated',
    )
    expect(migration).toContain(
      'revoke all on function public.get_instagram_connection_credentials(uuid, text)',
    )
    expect(migration).toContain('to service_role')
  })

  it('requires independent account ownership and encrypted credentials', () => {
    expect(migration).toContain('unique (instagram_user_id)')
    expect(migration).toContain('instagram_connection_owned_elsewhere')
    expect(migration).toContain("->> 'alg' <> 'aes-256-gcm'")
    expect(migration).toContain("? 'access_token'")
    expect(migration).toContain("? 'accessToken'")
  })

  it('connects fail-closed without activating Instagram rollout', () => {
    expect(migration).toContain("'connection_source', 'instagram_login'")
    expect(migration).toContain('rollout_enabled = false')
    expect(migration).toContain("'instagram.connection_connected'")
  })
})
