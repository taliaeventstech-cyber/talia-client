export const DEFAULT_WIDGET_LAUNCHER_ICON = 'talia' as const

export type WidgetLauncherIcon = 'talia' | 'chat' | 'bubble' | 'bot'

export function normalizeWidgetLauncherIcon(value: unknown): WidgetLauncherIcon {
  return value === 'chat' || value === 'bubble' || value === 'bot' ? value : DEFAULT_WIDGET_LAUNCHER_ICON
}
