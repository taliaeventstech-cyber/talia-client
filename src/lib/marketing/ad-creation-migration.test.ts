import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261011123000_meta_marketing_paused_image_ads.sql'),
  'utf8',
).toLowerCase()

describe('Meta Marketing paused traffic image-ad migration', () => {
  it('keeps request state backend-only and idempotent', () => {
    expect(migration).toContain('request_id uuid not null unique')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('revoke all on table public.meta_marketing_ad_creation_requests')
    expect(migration).toContain('on conflict (request_id) do nothing')
  })

  it('derives ad-set eligibility and connection controls server-side', () => {
    expect(migration).toContain('from public.meta_marketing_ad_set_creation_requests request')
    expect(migration).toContain("request.objective = 'outcome_traffic'")
    expect(migration).toContain("request.status = 'succeeded'")
    expect(migration).toContain('connection.rollout_enabled = true')
    expect(migration).toContain("connection.scopes @> array['ads_management']::text[]")
  })

  it('forces bounded content and records metadata without creative copy', () => {
    expect(migration).toContain("call_to_action in ('learn_more', 'buy_tickets')")
    expect(migration).toContain("'marketing.meta_ad_created'")
    expect(migration).toContain("'status', 'paused'")
    expect(migration).not.toContain('access_token')
    expect(migration).not.toContain("'primary_text', v_request.primary_text")
    expect(migration).not.toContain("'image_url', v_request.image_url")
  })
})
