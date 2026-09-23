import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260923120000_instagram_operator_handoff.sql', import.meta.url),
  'utf8',
)

describe('Instagram operator handoff migration', () => {
  it('adds tenant-scoped assignment and audited operator RPCs', () => {
    expect(migration).toContain('assigned_profile_id')
    expect(migration).toContain('claim_instagram_handoff')
    expect(migration).toContain('prepare_instagram_operator_reply')
    expect(migration).toContain('complete_instagram_operator_reply')
    expect(migration).toContain('ignore_instagram_handoff')
    expect(migration).toContain("'instagram.operator_reply_sent'")
    expect(migration).toContain('activate_instagram_operator_mode_on_handoff')
    expect(migration).toContain("'operator_mode_suppressed'")
  })

  it('enforces the standard and seven-day messaging windows before Meta is called', () => {
    expect(migration).toContain("interval '24 hours'")
    expect(migration).toContain("interval '7 days'")
    expect(migration).toContain("'human_agent_window_expired'")
    expect(migration).toContain("'use_human_agent_tag'")
  })

  it('keeps every operator function private to the service role', () => {
    expect(migration).toContain('revoke all on function public.claim_instagram_handoff')
    expect(migration).toContain('grant execute on function public.claim_instagram_handoff')
    expect(migration).toContain('to service_role')
  })
})
