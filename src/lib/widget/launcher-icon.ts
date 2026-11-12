export const DEFAULT_WIDGET_LAUNCHER_ICON = 'talia' as const

// `talia` is TALIA's face; `mark` is the open "Λ" monogram of the wordmark.
export const WIDGET_LAUNCHER_ICONS = ['talia', 'mark', 'chat', 'bubble', 'bot'] as const

export type WidgetLauncherIcon = (typeof WIDGET_LAUNCHER_ICONS)[number]

export function normalizeWidgetLauncherIcon(value: unknown): WidgetLauncherIcon {
  return typeof value === 'string' && (WIDGET_LAUNCHER_ICONS as readonly string[]).includes(value)
    ? value as WidgetLauncherIcon
    : DEFAULT_WIDGET_LAUNCHER_ICON
}
