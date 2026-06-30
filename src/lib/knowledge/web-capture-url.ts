import { createWebCaptureToken } from './web-capture-token'

export function getSignedCaptureUrl({
  tenantId,
  sourceId,
  sourceUrl,
  batchToken,
  batchIndex,
  batchTotal,
}: {
  tenantId: string
  sourceId: string
  sourceUrl: string
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
  }))
  if (batchToken && typeof batchIndex === 'number' && typeof batchTotal === 'number') {
    url.searchParams.set('talia_capture_batch', batchToken)
    url.searchParams.set('talia_capture_index', String(batchIndex))
    url.searchParams.set('talia_capture_total', String(batchTotal))
  }
  return url.toString()
}
