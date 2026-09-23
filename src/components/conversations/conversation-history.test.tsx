import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConversationHistory, getConversationStatusTone } from './conversation-history'

describe('ConversationHistory', () => {
  it('renders the shared channel history contract and extension slots', () => {
    const html = renderToStaticMarkup(
      <ConversationHistory
        eyebrow="Instagram"
        title="Conversations"
        description="All direct messages"
        countLabel="1 conversation"
        emptyTitle="No conversations"
        emptyDescription="Messages will appear here"
        labels={{
          identity: 'Contact',
          latestMessage: 'Latest message',
          status: 'Status',
          activity: 'Activity',
          messages: 'Messages',
          view: 'View conversation',
        }}
        locale="en-US"
        beforeTable={<aside>Channel summary</aside>}
        afterTable={<nav>Pagination</nav>}
        items={[{
          id: 'conversation-1',
          identity: { primary: 'Instagram', secondary: '•••• 1234' },
          latestMessage: 'Hello',
          status: { label: 'Open', tone: 'active' },
          activityAt: '2026-09-22T12:00:00.000Z',
          messageCount: 2,
          href: '/tenant/instagram/conversation-1',
          actions: <button type="button">Disconnect</button>,
        }]}
      />,
    )

    expect(html).toContain('All direct messages')
    expect(html).toContain('Channel summary')
    expect(html).toContain('•••• 1234')
    expect(html).toContain('status-pill-active')
    expect(html).toContain('/tenant/instagram/conversation-1')
    expect(html).toContain('Disconnect')
    expect(html).toContain('Pagination')
  })

  it('normalizes channel and delivery states into shared tones', () => {
    expect(getConversationStatusTone('handoff')).toBe('danger')
    expect(getConversationStatusTone('delivered')).toBe('active')
    expect(getConversationStatusTone('closed')).toBe('muted')
  })
})
