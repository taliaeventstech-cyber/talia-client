import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const campaignMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261006100000_meta_marketing_campaign_insights.sql'),
  'utf8',
)
const dailyInsightsMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261006110000_meta_marketing_daily_insights.sql'),
  'utf8',
)

describe('Meta Marketing campaign Insights migration', () => {
  it('keeps campaign data backend-only and venue scoped', () => {
    expect(campaignMigration).toContain(
      'alter table public.meta_marketing_campaign_snapshots enable row level security',
    )
    expect(campaignMigration).toContain('from public, anon, authenticated')
    expect(campaignMigration).toContain('foreign key (theatre_id, connection_id)')
  })

  it('keeps the applied campaign migration immutable', () => {
    expect(campaignMigration).not.toContain('meta_marketing_daily_insights')
    expect(campaignMigration).not.toContain('p_daily_insights')
  })

  it('adds daily Insights in a later migration', () => {
    expect(dailyInsightsMigration).toContain(
      'alter table public.meta_marketing_daily_insights enable row level security',
    )
    expect(dailyInsightsMigration).toContain(
      'replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb, jsonb)',
    )
    expect(dailyInsightsMigration).toContain(
      'replace_meta_marketing_campaign_snapshot(uuid, uuid, uuid, jsonb, jsonb)',
    )
  })

  it('replaces one bounded snapshot atomically', () => {
    expect(campaignMigration).toContain('jsonb_array_length(p_campaigns) > 500')
    expect(campaignMigration).toContain('delete from public.meta_marketing_campaign_snapshots')
    expect(campaignMigration).toContain('insert into public.meta_marketing_campaign_snapshots')
    expect(campaignMigration).toContain('meta_marketing_campaign_snapshot_duplicate')
    expect(dailyInsightsMigration).toContain('jsonb_array_length(p_daily_insights) > 31')
    expect(dailyInsightsMigration).toContain('delete from public.meta_marketing_daily_insights')
    expect(dailyInsightsMigration).toContain('insert into public.meta_marketing_daily_insights')
    expect(dailyInsightsMigration).toContain('meta_marketing_daily_insight_duplicate')
  })

  it('stores account totals separately from campaign rows', () => {
    expect(campaignMigration).toContain("'{marketing_sync}'")
    expect(campaignMigration).toContain("'campaign_count', v_campaign_count")
    expect(campaignMigration).toContain("'marketing.meta_snapshot_synced'")
    expect(dailyInsightsMigration).toContain("'daily_insights', coalesce((")
  })

  it('clears stale campaign and daily data when the selected account changes', () => {
    expect(dailyInsightsMigration).toContain('clear_meta_marketing_snapshot_on_account_change')
    expect(dailyInsightsMigration).toContain('delete from public.meta_marketing_campaign_snapshots')
    expect(dailyInsightsMigration).toContain('delete from public.meta_marketing_daily_insights')
    expect(dailyInsightsMigration).toContain("new.metadata := new.metadata - 'marketing_sync'")
  })
})
