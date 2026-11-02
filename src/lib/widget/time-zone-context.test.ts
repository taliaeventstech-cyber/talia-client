import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('widget time-zone context', () => {
  it('sends the visitor IANA time zone with chat messages', async () => {
    const widgetSource = await readFile(resolve(process.cwd(), 'public/widget.js'), 'utf8')

    expect(widgetSource).toContain('time_zone: getCurrentTimeZone()')
    expect(widgetSource).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone")
  })
})
