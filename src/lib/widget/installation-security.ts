const PRODUCTION_WIDGET_ORIGIN = 'https://agora.talia.events'

export function getWidgetInstallationSecurity(appUrl: string) {
  const origin = getOrigin(appUrl)
  return {
    origin,
    cspInstructions: [
      `script-src: añadir ${origin}`,
      `script-src-elem: si existe, añadir ${origin}`,
      `connect-src: añadir ${origin}`,
    ].join('\n'),
  }
}

function getOrigin(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin
  } catch {
    // Fall back to the canonical production origin below.
  }
  return PRODUCTION_WIDGET_ORIGIN
}
