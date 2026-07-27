import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('widget translation isolation', () => {
  it('protects the host, static chrome and dynamic messages from page translators', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain("host.classList.add('notranslate')")
    expect(widgetSource).toContain("host.setAttribute('translate', 'no')")
    expect(widgetSource).toContain('class="panel notranslate" data-panel translate="no"')
    expect(widgetSource).toContain('class="messages notranslate" data-messages translate="no"')
    expect(widgetSource).toContain("item.className = 'message notranslate ' + role")
    expect(widgetSource).toContain("item.setAttribute('translate', 'no')")
    expect(widgetSource).toContain('class="input notranslate" data-input translate="no"')
  })
})
