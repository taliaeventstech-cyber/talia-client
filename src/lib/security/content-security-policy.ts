function getOrigin(value: string | undefined) {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function buildContentSecurityPolicy(options: {
  isDevelopment: boolean
  nonce?: string
  supabaseUrl?: string
  splineSceneUrl?: string
}) {
  const supabaseOrigin = getOrigin(options.supabaseUrl)
  const splineOrigin = getOrigin(options.splineSceneUrl)
  const connectSources = ["'self'", supabaseOrigin, splineOrigin]
    .filter((value): value is string => Boolean(value))

  if (supabaseOrigin?.startsWith('https://')) {
    connectSources.push(supabaseOrigin.replace('https://', 'wss://'))
  }

  const scriptSources = options.nonce
    ? ["'self'", `'nonce-${options.nonce}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'"]
  if (options.isDevelopment) scriptSources.push("'unsafe-eval'")

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}
