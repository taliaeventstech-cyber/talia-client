import { describe, expect, it } from 'vitest'
import { getWidgetInstallationSecurity } from './installation-security'

describe('widget installation security requirements', () => {
  it('derives the CSP allowlist from the public widget origin', () => {
    expect(getWidgetInstallationSecurity('https://agora.talia.events/')).toEqual({
      origin: 'https://agora.talia.events',
      cspInstructions: [
        'script-src: añadir https://agora.talia.events',
        'script-src-elem: si existe, añadir https://agora.talia.events',
        'connect-src: añadir https://agora.talia.events',
      ].join('\n'),
    })
  })

  it('uses the safe production origin when the configured URL is invalid', () => {
    expect(getWidgetInstallationSecurity('not-a-url').origin).toBe('https://agora.talia.events')
  })
})
