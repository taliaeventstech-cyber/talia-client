import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('disabled widget installation', () => {
  it('treats disabled configuration as a silent installed state', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("if (config.enabled === false)")
    expect(widgetSource).toContain("window.__taliaWidgetTenants[tenantId] = 'disabled'")
    expect(widgetSource).toContain("'/api/widget/' + tenantId + '/installation'")
    expect(widgetSource).toContain('registerWidgetInstallation();')
  })
})
