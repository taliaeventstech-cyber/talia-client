import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('widget purchase action', () => {
  it('renders a localized official purchase CTA without printing a raw URL', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("action.type === 'purchase'")
    expect(widgetSource).toContain("card.className = 'purchase-card'")
    expect(widgetSource).toContain("link.className = 'purchase-open-link'")
    expect(widgetSource).toContain('getPurchaseActionCopy(language)')
    expect(widgetSource).toContain("link.target = '_blank'")
    expect(widgetSource).toContain("link.rel = 'noopener noreferrer'")
  })
})
