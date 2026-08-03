export function getWidgetEmbedCode({
  appUrl = getPublicWidgetAppUrl(),
  tenantId,
  websiteUrl,
}: {
  appUrl?: string
  tenantId: string
  websiteUrl: string | null
}) {
  const normalizedAppUrl = appUrl.replace(/\/$/, '')
  const siteOrigin = getSiteOrigin(websiteUrl)
  const siteOriginAttribute = siteOrigin ? `\n  data-site-origin="${siteOrigin}"` : ''

  return `<script
  src="${normalizedAppUrl}/widget.js"
  async
  crossorigin="anonymous"
  data-tenant="${tenantId}"
  data-api-base="${normalizedAppUrl}"${siteOriginAttribute}
></script>`
}

function getSiteOrigin(value: string | null) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function getPublicWidgetAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
