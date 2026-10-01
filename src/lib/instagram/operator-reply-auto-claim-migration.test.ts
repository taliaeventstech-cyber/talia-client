import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(
  process.cwd(),
  'supabase/migrations/20261001143500_instagram_operator_reply_auto_claim.sql',
), 'utf8')

describe('Instagram operator reply auto-claim migration', () => {
  it('claims a free handoff while holding the conversation row lock', () => {
    expect(migration).toContain('for update;')
    expect(migration).toContain('if v_conversation.assigned_profile_id is null then')
    expect(migration).toContain('set assigned_profile_id = v_profile_id')
    expect(migration).toContain("'claim_source', 'operator_reply'")
  })

  it('refuses to send through a handoff assigned to another operator', () => {
    expect(migration).toContain(
      'elsif v_conversation.assigned_profile_id is distinct from v_profile_id then',
    )
    expect(migration).toContain("return jsonb_build_object('state', 'not_assigned')")
  })

  it('keeps idempotency and the Meta human-agent window checks', () => {
    expect(migration).toContain("message.metadata ->> 'operator_idempotency_key'")
    expect(migration).toContain("interval '7 days'")
    expect(migration).toContain("interval '24 hours'")
  })
})
