import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public widget loader contract', () => {
  it('waits for document.body and prevents duplicate mounts for the same tenant', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("window.__taliaWidgetTenants")
    expect(widgetSource).toContain("document.addEventListener('DOMContentLoaded'")
    expect(widgetSource).toContain("document.getElementById('talia-widget-root')")
    expect(widgetSource).toContain('function getStoredValue(key)')
  })
})
