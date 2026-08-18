import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MessageAttentionNavigator } from './message-attention-navigator'

describe('MessageAttentionNavigator', () => {
  it('renders a reusable pending-message navigator', () => {
    const html = renderToStaticMarkup(
      <MessageAttentionNavigator
        currentLabel="Needs attention"
        items={[{ targetId: 'message-1' }]}
        next="Next pending message"
        none="Nothing pending"
        position="Pending {current} of {total}"
        previous="Previous pending message"
        statuses={[{ label: 'Pending', count: 1, tone: 'pending' }]}
        title="Human attention"
      />,
    )

    expect(html).toContain('Human attention')
    expect(html).toContain('Pending: 1')
    expect(html).toContain('Needs attention')
    expect(html).toContain('Pending 1 of 1')
    expect(html).toContain('aria-label="Previous pending message"')
    expect(html).toContain('aria-label="Next pending message"')
  })
})
