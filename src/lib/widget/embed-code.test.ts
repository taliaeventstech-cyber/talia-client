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
  crossorigin="anonymous"
  data-tenant="venue-123"
  data-api-base="https://app.talia.example"
  data-site-origin="https://venue.example"
></script>`)
  })

  it('omits the site origin when the venue website is unavailable', () => {
    expect(getWidgetEmbedCode({
      appUrl: 'https://app.talia.example',
      tenantId: 'venue-123',
      websiteUrl: null,
    })).not.toContain('data-site-origin')
  })
})
