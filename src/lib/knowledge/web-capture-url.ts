import { createWebCaptureToken } from './web-capture-token'

const CAPTURE_URL_TOKEN_TTL_SECONDS = 15 * 60

export function getSignedCaptureUrl({
  tenantId,
  documentId,
  sourceUrl,
  captureApiBase,
  batchToken,
  batchIndex,
  batchTotal,
}: {
  tenantId: string
  documentId: string
  sourceUrl: string
  captureApiBase?: string
  batchToken?: string
  batchIndex?: number
  batchTotal?: number
}) {
  const url = new URL(sourceUrl)
  url.hash = ''
  const signedUrl = url.toString()
  const captureParams = new URLSearchParams()
  captureParams.set('talia_capture', '1')
  captureParams.set('talia_capture_token', createWebCaptureToken({
    tenantId,
    documentId,
    url: signedUrl,
    expiresInSeconds: CAPTURE_URL_TOKEN_TTL_SECONDS,
  }))
  if (captureApiBase) {
    captureParams.set('talia_capture_api_base', captureApiBase)
  }
  if (batchToken && typeof batchIndex === 'number' && typeof batchTotal === 'number') {
    captureParams.set('talia_capture_batch', batchToken)
    captureParams.set('talia_capture_index', String(batchIndex))
    captureParams.set('talia_capture_total', String(batchTotal))
  }
  url.hash = captureParams.toString()
  return url.toString()
}
