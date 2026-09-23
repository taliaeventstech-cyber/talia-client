import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260922183000_instagram_conversation_history_and_disconnect.sql', import.meta.url),
  'utf8',
)

describe('Instagram conversation history migration', () => {
  it('authorizes viewers and keeps provider identifiers masked', () => {
    expect(migration).toContain('authorize_instagram_operator')
    expect(migration).toContain("'•••• ' || right(contact.instagram_scoped_user_id, 4)")
    expect(migration).not.toContain("'instagram_scoped_user_id', contact.instagram_scoped_user_id")
  })

  it('exposes history, detail, and disconnect context only to the service role', () => {
    expect(migration).toContain('get_instagram_conversation_history')
    expect(migration).toContain('get_instagram_conversation_detail')
    expect(migration).toContain('get_instagram_connection_disconnect_context')
    expect(migration).toContain('to service_role')
  })
})
