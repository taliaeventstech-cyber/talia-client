import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261006100000_meta_marketing_campaign_insights.sql'),
  'utf8',
)

describe('Meta Marketing campaign Insights migration', () => {
  it('keeps campaign data backend-only and venue scoped', () => {
    expect(migration).toContain(
      'alter table public.meta_marketing_campaign_snapshots enable row level security',
    )
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('foreign key (theatre_id, connection_id)')
    expect(migration).toContain(
      'alter table public.meta_marketing_daily_insights enable row level security',
    )
  })

  it('replaces one bounded snapshot atomically', () => {
    expect(migration).toContain('jsonb_array_length(p_campaigns) > 500')
    expect(migration).toContain('delete from public.meta_marketing_campaign_snapshots')
    expect(migration).toContain('insert into public.meta_marketing_campaign_snapshots')
    expect(migration).toContain('meta_marketing_campaign_snapshot_duplicate')
    expect(migration).toContain('jsonb_array_length(p_daily_insights) > 31')
    expect(migration).toContain('delete from public.meta_marketing_daily_insights')
    expect(migration).toContain('insert into public.meta_marketing_daily_insights')
    expect(migration).toContain('meta_marketing_daily_insight_duplicate')
  })

  it('stores account totals separately from campaign rows', () => {
    expect(migration).toContain("'{marketing_sync}'")
    expect(migration).toContain("'campaign_count', v_campaign_count")
    expect(migration).toContain("'marketing.meta_snapshot_synced'")
    expect(migration).toContain("'daily_insights', coalesce((")
  })

  it('clears stale campaign and daily data when the selected account changes', () => {
    expect(migration).toContain('clear_meta_marketing_snapshot_on_account_change')
    expect(migration).toContain("new.metadata := new.metadata - 'marketing_sync'")
  })
})
