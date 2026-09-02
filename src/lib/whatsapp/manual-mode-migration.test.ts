import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260902180000_whatsapp_manual_mode.sql'),
  'utf8',
)

describe('WhatsApp manual mode migration', () => {
  it('supports audited takeover and release', () => {
    expect(migration).toContain('create or replace function public.take_over_whatsapp_conversation')
    expect(migration).toContain("'whatsapp.conversation_taken_over'")
    expect(migration).toContain('create or replace function public.release_whatsapp_conversation')
    expect(migration).toContain("'whatsapp.conversation_released_to_ai'")
    expect(migration).toContain("not coalesce(v_conversation.metadata ->> 'operator_mode' = 'true', false)")
  })

  it('prevents inbound jobs from reaching TALIA while a human is in control', () => {
    expect(migration).toContain("conversation.metadata ->> 'operator_mode' = 'true'")
    expect(migration).toContain("set status = 'completed'")
    expect(migration).toContain("processing_status = 'handoff'")
  })

  it('serializes takeover with automated sends and suppresses queued replies', () => {
    expect(migration).toContain('for update of job')
    expect(migration).toContain("message.metadata ? 'agent_reply_to_message_id'")
    expect(migration).toContain("message.delivery_status = 'sending'")
    expect(migration).toContain("return 'send_in_progress'")
    expect(migration).toContain("message.delivery_status = 'queued'")
    expect(migration).toContain("'operator_mode_suppressed', true")
  })

  it('keeps manual mode active after a successful operator reply', () => {
    expect(migration).toContain("when metadata ->> 'operator_mode' = 'true' then 'handoff'")
    expect(migration).toContain("'operator_mode_active', v_operator_mode")
  })
})
