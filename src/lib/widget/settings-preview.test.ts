import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('web agent settings preview', () => {
  it('starts with the chat panel open instead of the launcher greeting', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/app/(dashboard)/[tenantId]/settings/settings-form.tsx'),
      'utf8',
    )

    expect(source).toContain('const [panelOpen, setPanelOpen] = useState(true)')
    expect(source).toContain('const [greetingVisible, setGreetingVisible] = useState(false)')
  })
})
