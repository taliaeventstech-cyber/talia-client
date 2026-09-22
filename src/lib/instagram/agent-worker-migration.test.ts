import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(path.join(
  process.cwd(),
  'supabase/migrations/20260922130000_instagram_agent_worker.sql',
), 'utf8')

describe('Instagram agent worker migration', () => {
  it('leases only Instagram jobs for rollout-enabled Instagram connections', () => {
    expect(migration).toContain('create or replace function public.claim_instagram_inbound_jobs')
    expect(migration).toContain("connection.status = 'connected'")
    expect(migration).toContain('connection.rollout_enabled')
    expect(migration).toContain('for update of job skip locked')
    expect(migration).toContain("earlier_job.status in ('pending', 'retry', 'processing')")
    expect(migration).toContain('earlier_message.conversation_id = inbound.conversation_id')
    expect(migration).not.toContain('whatsapp_')
  })

  it('creates a durable reply before crossing the provider-send boundary', () => {
    const prepareIndex = migration.indexOf('create or replace function public.prepare_instagram_agent_reply')
    const startIndex = migration.indexOf('create or replace function public.start_instagram_agent_send')
    expect(prepareIndex).toBeGreaterThan(-1)
    expect(startIndex).toBeGreaterThan(prepareIndex)
    expect(migration).toContain('instagram_messages_one_agent_reply_idx')
    expect(migration).toContain("delivery_status = 'sending'")
  })

  it('exposes worker operations only to the service role', () => {
    expect(migration).toContain(
      'revoke all on function public.claim_instagram_inbound_jobs(text, integer, integer) from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant execute on function public.claim_instagram_inbound_jobs(text, integer, integer) to service_role',
    )
  })
})
