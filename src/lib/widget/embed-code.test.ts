import { describe, expect, it } from 'vitest'
import { getWidgetEmbedCode } from './embed-code'

describe('widget embed code', () => {
  it('builds the same tenant-scoped snippet for every dashboard surface', () => {
    expect(getWidgetEmbedCode({
      appUrl: 'https://app.talia.example/',
      tenantId: 'venue-123',
      websiteUrl: 'https://venue.example/programacio',
    })).toBe(`<script
  src="https://app.talia.example/widget.js"
  async
  crossorigin="anonymous"
  data-tenant="venue-123"
  data-api-base="https://app.talia.example"
  data-site-origin="https://venue.example"
></script>`)
  })

  it('generates a non-blocking external script without inline JavaScript', () => {
    const snippet = getWidgetEmbedCode({
      appUrl: 'https://agora.talia.events',
      tenantId: 'venue-123',
      websiteUrl: null,
    })

    expect(snippet).toContain('src="https://agora.talia.events/widget.js"')
    expect(snippet).toContain('\n  async\n')
    expect(snippet).not.toContain('<script type="text/javascript">')
    expect(snippet).not.toContain('window.TALIA')
  })

  it('omits the site origin when the venue website is unavailable', () => {
    expect(getWidgetEmbedCode({
      appUrl: 'https://app.talia.example',
      tenantId: 'venue-123',
      websiteUrl: null,
    })).not.toContain('data-site-origin')
  })
})
