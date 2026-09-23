import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConversationDetailHeader, ConversationMessageList } from './conversation-detail'

describe('shared conversation detail components', () => {
  it('renders channel metadata through the shared header', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailHeader
        backHref="/tenant/whatsapp"
        backLabel="Back"
        eyebrow="WhatsApp"
        title="Conversation"
        metadata={[
          { label: 'Contact', value: '•••• 1234' },
          { label: 'Assigned to', value: 'Operator' },
        ]}
        actions={<button type="button">Delete</button>}
      />,
    )

    expect(html).toContain('/tenant/whatsapp')
    expect(html).toContain('•••• 1234')
    expect(html).toContain('Assigned to')
    expect(html).toContain('Delete')
  })

  it('renders normalized messages and channel-specific extras', () => {
    const html = renderToStaticMarkup(
      <ConversationMessageList
        ariaLabel="Conversation"
        locale="en-US"
        items={[{
          id: 'message-1',
          senderLabel: 'TALIA',
          body: 'How can I help?',
          createdAt: '2026-09-22T12:00:00.000Z',
          isAssistant: true,
          anchorId: 'response-message-1',
          delivery: { label: 'Read', tone: 'active' },
          extras: <button type="button">Create FAQ</button>,
        }]}
      />,
    )

    expect(html).toContain('message-card-assistant')
    expect(html).toContain('response-message-1')
    expect(html).toContain('How can I help?')
    expect(html).toContain('Read')
    expect(html).toContain('Create FAQ')
  })
})
