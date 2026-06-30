import { createWebCaptureToken } from './web-capture-token'

const CAPTURE_URL_TOKEN_TTL_SECONDS = 15 * 60

export function getSignedCaptureUrl({
  tenantId,
  sourceId,
  sourceUrl,
  captureApiBase,
  batchToken,
  batchIndex,
  batchTotal,
}: {
  tenantId: string
  sourceId: string
  sourceUrl: string
  captureApiBase?: string
  batchToken?: string
  batchIndex?: number
  batchTotal?: number
}) {
  const url = new URL(sourceUrl)
  url.hash = ''
  const signedUrl = url.toString()
  url.searchParams.set('talia_capture', '1')
  url.searchParams.set('talia_capture_token', createWebCaptureToken({
    tenantId,
    sourceId,
    url: signedUrl,
    expiresInSeconds: CAPTURE_URL_TOKEN_TTL_SECONDS,
  }))
  if (captureApiBase) {
    url.searchParams.set('talia_capture_api_base', captureApiBase)
  }
  if (batchToken && typeof batchIndex === 'number' && typeof batchTotal === 'number') {
    url.searchParams.set('talia_capture_batch', batchToken)
    url.searchParams.set('talia_capture_index', String(batchIndex))
    url.searchParams.set('talia_capture_total', String(batchTotal))
  }
  return url.toString()
}
