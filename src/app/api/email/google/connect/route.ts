import { getGoogleAuthorizationUrl } from '@/lib/email/google-oauth'
import { requireEmailAgentPreviewProductAccess } from '@/lib/email/legacy-access'
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
    console.error('[email-google-connect]', error)
    return NextResponse.redirect(new URL(`/${tenantId}/email?email_error=oauth_config`, request.url))
  }
}
