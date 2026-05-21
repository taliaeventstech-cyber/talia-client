import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { getMicrosoftAuthorizationUrl } from '@/lib/email/microsoft-oauth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
  }

  try {
    const access = await requireTenantPermission(tenantId, 'manage_email', 'email')
    const authorizationUrl = getMicrosoftAuthorizationUrl({ tenantId, userId: access.userId })

    return NextResponse.redirect(authorizationUrl)
  } catch (error) {
    console.error('[email-microsoft-connect]', error)
    return NextResponse.redirect(new URL(`/${tenantId}/email?email_error=oauth_config`, request.url))
  }
}
