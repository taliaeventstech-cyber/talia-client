import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('widget location action', () => {
  it('renders a localized map card and keeps a CSP-safe external Maps fallback', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("action.type === 'location'")
    expect(widgetSource).toContain("card.className = 'location-card'")
    expect(widgetSource).toContain("frame.className = 'location-map-frame'")
    expect(widgetSource).toContain('getLocationActionCopy(language)')
    expect(widgetSource).toContain("window.addEventListener('securitypolicyviolation'")
    expect(widgetSource).toContain('action.embed_href')
    expect(widgetSource).toContain('action.href')
  })
})
