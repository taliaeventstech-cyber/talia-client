import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261010120000_meta_marketing_paused_traffic_ad_sets.sql'),
  'utf8',
).toLowerCase()

describe('Meta Marketing traffic ad-set creation migration', () => {
  it('keeps request state backend-only and idempotent', () => {
    expect(migration).toContain('request_id uuid not null unique')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('revoke all on table public.meta_marketing_ad_set_creation_requests')
    expect(migration).toContain('on conflict (request_id) do nothing')
  })

  it('derives campaign eligibility and connection controls server-side', () => {
    expect(migration).toContain("snapshot.objective = 'outcome_traffic'")
    expect(migration).toContain("request.objective = 'outcome_traffic'")
    expect(migration).toContain('connection.rollout_enabled = true')
    expect(migration).toContain("connection.scopes @> array['ads_management']::text[]")
    expect(migration).toContain('connection.ad_account_currency = upper(trim(p_expected_currency))')
  })

  it('bounds schedule, targeting and audit data', () => {
    expect(migration).toContain("end_time <= start_time + interval '366 days'")
    expect(migration).toContain('cardinality(v_countries) not between 1 and 25')
    expect(migration).toContain("'marketing.meta_ad_set_created'")
    expect(migration).toContain("'marketing.meta_ad_set_create_failed'")
    expect(migration).not.toContain('access_token')
    expect(migration).not.toContain('provider_response')
  })
})
