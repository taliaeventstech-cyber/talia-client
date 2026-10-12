import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261007193000_meta_marketing_paused_campaign_creation.sql'),
  'utf8',
).toLowerCase()

describe('Meta Marketing campaign creation migration', () => {
  it('keeps creation state backend-only and idempotent', () => {
    expect(migration).toContain('request_id uuid not null unique')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain(
      'revoke all on table public.meta_marketing_campaign_creation_requests',
    )
    expect(migration).toContain('on conflict (request_id) do nothing')
  })

  it('requires rollout, write scope and explicit category confirmation', () => {
    expect(migration).toContain('connection.rollout_enabled = true')
    expect(migration).toContain("connection.scopes @> array['ads_management']::text[]")
    expect(migration).toContain('p_no_special_ad_category_confirmed is not true')
  })

  it('audits success and failure without provider payloads or credentials', () => {
    expect(migration).toContain("'marketing.meta_campaign_created'")
    expect(migration).toContain("'marketing.meta_campaign_create_failed'")
    expect(migration).not.toContain('access_token')
    expect(migration).not.toContain('provider_response')
  })
})
