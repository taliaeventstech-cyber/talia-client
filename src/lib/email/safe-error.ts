const SAFE_EMAIL_ERROR_CODE = /^[a-z0-9_]+(?::[1-5][0-9]{2})?$/

export function createEmailProviderError(code: string, status: number) {
  return new Error(`${code}:${status}`)
}

export function getSafeEmailErrorCode(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  return SAFE_EMAIL_ERROR_CODE.test(message) ? message : fallback
}

export function logSafeEmailError(event: string, error: unknown, fallback: string) {
  console.error(JSON.stringify({
    event,
    error_code: getSafeEmailErrorCode(error, fallback),
  }))
}
