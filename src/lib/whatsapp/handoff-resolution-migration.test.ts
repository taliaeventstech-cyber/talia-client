import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260818130000_whatsapp_handoff_resolution_ux.sql'),
  'utf8',
)

describe('WhatsApp handoff resolution migration', () => {
  it('resolves a handoff only after an operator reply is confirmed', () => {
    expect(migration).toContain('create or replace function public.complete_whatsapp_operator_reply')
    expect(migration).toContain("metadata = metadata || jsonb_build_object('resolution_reason', 'operator_replied')")
    expect(migration).toContain("and delivery_status = 'sending'")
  })

  it('supports an audited ignore decision without sending a reply', () => {
    expect(migration).toContain('create or replace function public.ignore_whatsapp_handoff')
    expect(migration).toContain("'whatsapp.handoff_ignored'")
    expect(migration).toContain("'resolution_reason', 'operator_ignored'")
    expect(migration).toContain('grant execute on function public.ignore_whatsapp_handoff')
  })
})
