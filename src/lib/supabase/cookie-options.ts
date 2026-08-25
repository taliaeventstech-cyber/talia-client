export function getSupabaseCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    path: '/',
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production',
  }
}
