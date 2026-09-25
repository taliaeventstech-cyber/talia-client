import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260923213000_instagram_manual_mode.sql', import.meta.url),
  'utf8',
)

describe('Instagram manual mode migration', () => {
  it('adds audited proactive takeover and release RPCs', () => {
    expect(migration).toContain('take_over_instagram_conversation')
    expect(migration).toContain('release_instagram_conversation')
    expect(migration).toContain("'instagram.conversation_taken_over'")
    expect(migration).toContain("'instagram.conversation_released_to_ai'")
    expect(migration).toContain("'operator_mode_source', 'proactive'")
  })

  it('serializes takeover with active jobs and refuses an in-flight provider send', () => {
    const jobLock = migration.indexOf('for update of job')
    const conversationLock = migration.indexOf('for update;', jobLock)
    expect(jobLock).toBeGreaterThan(-1)
    expect(conversationLock).toBeGreaterThan(jobLock)
    expect(migration).toContain("job.status in ('pending', 'retry', 'processing')")
    expect(migration).toContain("message.delivery_status = 'sending'")
    expect(migration).toContain("'operator_mode_suppressed', true")
  })

  it('keeps proactive manual mode active after a human reply until explicit release', () => {
    expect(migration).toContain("v_operator_mode_source = 'proactive'")
    expect(migration).toContain("when v_proactive_mode then 'handoff'")
    expect(migration).toContain("when v_proactive_mode then null else clock_timestamp()")
    expect(migration).toContain("'operator_mode_reply'")
  })

  it('keeps the new functions private to the service role', () => {
    expect(migration).toContain('revoke all on function public.take_over_instagram_conversation')
    expect(migration).toContain('revoke all on function public.release_instagram_conversation')
    expect(migration).toContain('grant execute on function public.take_over_instagram_conversation')
    expect(migration).toContain('grant execute on function public.release_instagram_conversation')
  })
})
