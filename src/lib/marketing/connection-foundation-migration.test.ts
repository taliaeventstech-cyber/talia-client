import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261005130000_meta_marketing_connection_foundation.sql'),
  'utf8',
)

describe('Meta Marketing connection foundation migration', () => {
  it('keeps connections and credentials unavailable to browser database roles', () => {
    expect(migration).toContain(
      'alter table public.meta_marketing_connections enable row level security',
    )
    expect(migration).toContain(
      'revoke all on table public.meta_marketing_connections from public, anon, authenticated',
    )
    expect(migration).toContain(
      'revoke all on function public.get_meta_marketing_connection_credentials(uuid, text)',
    )
    expect(migration).toContain('to service_role')
  })

  it('requires an independently owned ad account and encrypted credentials', () => {
    expect(migration).toContain('unique (ad_account_id)')
    expect(migration).toContain('meta_marketing_connection_owned_elsewhere')
    expect(migration).toContain("->> 'alg' <> 'aes-256-gcm'")
    expect(migration).toContain("? 'access_token'")
    expect(migration).toContain("? 'accessToken'")
  })

  it('requires reporting and management scopes', () => {
    expect(migration).toContain("array['ads_read', 'ads_management']::text[]")
  })

  it('connects fail-closed without enabling rollout or spend', () => {
    expect(migration).toContain("'connection_source', 'meta_marketing_oauth'")
    expect(migration).toContain('rollout_enabled = false')
    expect(migration).toContain("'marketing.meta_connection_connected'")
  })

  it('clears credentials and audits disconnects', () => {
    expect(migration).toContain("credential_metadata = '{}'::jsonb")
    expect(migration).toContain("'marketing.meta_connection_disconnected'")
  })
})
