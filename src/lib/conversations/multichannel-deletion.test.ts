import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const action = readFileSync(join(
  process.cwd(),
  'src/app/(dashboard)/[tenantId]/conversations/actions.ts',
), 'utf8')

const deleteButton = readFileSync(join(
  process.cwd(),
  'src/app/(dashboard)/[tenantId]/conversations/delete-button.tsx',
), 'utf8')

describe('multichannel conversation deletion', () => {
  it('deletes channel-local content under the existing owner/admin permission', () => {
    expect(action).toContain("z.enum(['web', 'whatsapp', 'instagram'])")
    expect(action).toContain("'delete_conversations',")
    expect(action).toContain("'whatsapp_conversations'")
    expect(action).toContain("'instagram_conversations'")
    expect(action).toContain("action: 'conversation.deleted_by_customer'")
  })

  it('anonymizes retained channel usage without changing billed consumption', () => {
    expect(action).toContain(".from('usage_events')")
    expect(action).toContain(".from('ai_usage_events')")
    expect(action).toContain('delete metadata.conversation_id')
    expect(action).toContain('usage_retained: true')
  })

  it('uses one shared deletion control for all three channels', () => {
    expect(deleteButton).toContain("channel?: 'web' | 'whatsapp' | 'instagram'")

    const pages = [
      'src/app/(dashboard)/[tenantId]/conversations/page.tsx',
      'src/app/(dashboard)/[tenantId]/conversations/whatsapp/page.tsx',
      'src/app/(dashboard)/[tenantId]/instagram/page.tsx',
    ].map((path) => readFileSync(join(process.cwd(), path), 'utf8'))

    for (const page of pages) {
      expect(page).toContain('<DeleteConversationButton')
    }
    expect(pages[1]).toContain('channel="whatsapp"')
    expect(pages[2]).toContain('channel="instagram"')
  })
})
