export type InstalledWebCaptureMode = 'manual' | 'automatic'

export type InstalledWebCaptureSettings = {
  enabled: boolean
  mode: InstalledWebCaptureMode
}

export const DEFAULT_INSTALLED_WEB_CAPTURE_SETTINGS: InstalledWebCaptureSettings = {
  enabled: false,
  mode: 'manual',
}

export function normalizeInstalledWebCaptureSettings(value: unknown): InstalledWebCaptureSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_INSTALLED_WEB_CAPTURE_SETTINGS
  }

  const settings = value as Record<string, unknown>
  return {
    enabled: settings.enabled === true,
    mode: settings.mode === 'automatic' ? 'automatic' : 'manual',
  }
}

export function getInstalledWebCaptureSettingsFromWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_INSTALLED_WEB_CAPTURE_SETTINGS
  }

  const config = value as Record<string, unknown>
  return normalizeInstalledWebCaptureSettings(
    config.installedWebCapture ?? config.installed_web_capture,
  )
}
