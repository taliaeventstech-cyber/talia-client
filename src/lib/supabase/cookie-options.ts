export function getSupabaseCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production',
  }
}
