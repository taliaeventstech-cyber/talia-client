export function isChatbotSetupCompleted(input: {
  widgetConfig?: unknown
}) {
  const widgetConfig = input.widgetConfig
  if (!widgetConfig || typeof widgetConfig !== 'object' || Array.isArray(widgetConfig)) return false
  return (widgetConfig as { setupCompleted?: unknown }).setupCompleted === true
}
