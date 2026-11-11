import { describe, expect, it } from 'vitest'
import { normalizeWidgetLauncherIcon } from './launcher-icon'

describe('normalizeWidgetLauncherIcon', () => {
  it('keeps supported launcher icons', () => {
    expect(normalizeWidgetLauncherIcon('talia')).toBe('talia')
    expect(normalizeWidgetLauncherIcon('mark')).toBe('mark')
    expect(normalizeWidgetLauncherIcon('chat')).toBe('chat')
    expect(normalizeWidgetLauncherIcon('bubble')).toBe('bubble')
    expect(normalizeWidgetLauncherIcon('bot')).toBe('bot')
  })

  it('falls back to the TALIA icon for old or invalid configurations', () => {
    expect(normalizeWidgetLauncherIcon(undefined)).toBe('talia')
    expect(normalizeWidgetLauncherIcon('unknown')).toBe('talia')
  })
})
