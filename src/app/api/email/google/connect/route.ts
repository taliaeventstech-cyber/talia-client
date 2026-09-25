import { getGoogleAuthorizationUrl } from '@/lib/email/google-oauth'
import { requireEmailAgentPreviewProductAccess } from '@/lib/email/legacy-access'
import { logSafeEmailError } from '@/lib/email/safe-error'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
  }

  try {
    const access = await requireEmailAgentPreviewProductAccess(tenantId)
    const authorizationUrl = getGoogleAuthorizationUrl({ tenantId, userId: access.userId })

    return NextResponse.redirect(authorizationUrl)
  } catch (error) {
    logSafeEmailError('email_google_connect_failed', error, 'google_oauth_config_failed')
    return NextResponse.redirect(new URL(`/${tenantId}/email/settings?email_error=oauth_config`, request.url))
  }
}
