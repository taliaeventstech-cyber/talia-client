import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260922110000_instagram_inbound_foundation.sql',
)
const migration = fs.readFileSync(migrationPath, 'utf8')

describe('Instagram inbound foundation migration', () => {
  it('keeps every channel-local content table backend-only', () => {
    for (const table of [
      'instagram_contacts',
      'instagram_conversations',
      'instagram_messages',
      'instagram_inbound_jobs',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      )
    }
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete|all)\s+on\s+table[\s\S]*authenticated/i)
  })

  it('fails closed on connection, rollout, module and entitlement before storing content', () => {
    const gateIndex = migration.indexOf("v_connection.rollout_enabled")
    const contactInsertIndex = migration.indexOf('insert into public.instagram_contacts')

    expect(gateIndex).toBeGreaterThan(-1)
    expect(migration).toContain("v_connection.status = 'connected'")
    expect(migration).toContain("module.module_key = 'instagram'")
    expect(migration).toContain("entitlement.module_key = 'instagram'")
    expect(gateIndex).toBeLessThan(contactInsertIndex)
  })

  it('deduplicates provider messages and never stores a raw webhook payload', () => {
    expect(migration).toContain('unique (connection_id, provider_message_id)')
    expect(migration).toContain('on conflict (connection_id, provider_message_id) do nothing')
    expect(migration).not.toMatch(/raw_(payload|webhook)|webhook_payload/i)
  })

  it('uses Instagram-only tables and queue operations', () => {
    expect(migration).toContain('create or replace function public.ingest_instagram_message')
    expect(migration).toContain('insert into public.instagram_inbound_jobs')
    expect(migration).not.toContain('whatsapp_')
  })
})
