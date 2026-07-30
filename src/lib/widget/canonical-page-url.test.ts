import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('widget canonical page URL', () => {
  it('prefers the page canonical URL before mapping the current browser URL', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')
    const functionStart = widgetSource.indexOf('function getCanonicalPageUrl()')
    const functionEnd = widgetSource.indexOf('function normalizePublicPageUrl', functionStart)
    const implementation = widgetSource.slice(functionStart, functionEnd)

    expect(functionStart).toBeGreaterThan(-1)
    expect(implementation.indexOf("document.querySelector('link[rel=\"canonical\"]')"))
      .toBeLessThan(implementation.indexOf('getMappedSiteOriginUrl(siteOriginOverride'))
  })
})
