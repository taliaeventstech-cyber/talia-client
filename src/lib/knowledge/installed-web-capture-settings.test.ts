import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSTALLED_WEB_CAPTURE_SETTINGS,
  getInstalledWebCaptureSettingsFromWidgetConfig,
  normalizeInstalledWebCaptureSettings,
} from './installed-web-capture-settings'

describe('installed web capture settings', () => {
  it('defaults to disabled manual capture', () => {
    expect(normalizeInstalledWebCaptureSettings(undefined)).toEqual(DEFAULT_INSTALLED_WEB_CAPTURE_SETTINGS)
  })

  it('normalizes automatic capture', () => {
    expect(normalizeInstalledWebCaptureSettings({ enabled: true, mode: 'automatic' })).toEqual({
      enabled: true,
      mode: 'automatic',
    })
  })

  it('reads camelCase and legacy snake_case widget keys', () => {
    expect(getInstalledWebCaptureSettingsFromWidgetConfig({ installedWebCapture: { enabled: true } })).toEqual({
      enabled: true,
      mode: 'manual',
    })
    expect(getInstalledWebCaptureSettingsFromWidgetConfig({ installed_web_capture: { enabled: true, mode: 'automatic' } })).toEqual({
      enabled: true,
      mode: 'automatic',
    })
  })
})
