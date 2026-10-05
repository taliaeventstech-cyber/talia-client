import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getMetaMarketingAuthorizationUrl } from '@/lib/marketing/oauth'
import { META_MARKETING_OAUTH_COOKIE } from '@/lib/marketing/oauth-session'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!z.uuid().safeParse(tenantId).success) {
    return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })
  }

  try {
    const access = await requireTenantProductAccess(
      tenantId!,
      'manage_marketing',
      'marketing',
    )
    const response = NextResponse.redirect(getMetaMarketingAuthorizationUrl({
      tenantId: tenantId!,
      userId: access.userId,
    }))
    response.cookies.delete(META_MARKETING_OAUTH_COOKIE)
    return response
  } catch (error) {
    console.error('[meta-marketing-oauth] connect failed', {
      tenantId,
      code: getSafeErrorCode(error),
    })
    const response = NextResponse.redirect(
      new URL(`/${tenantId}/marketing?meta_error=oauth_config`, request.url),
    )
    response.cookies.delete(META_MARKETING_OAUTH_COOKIE)
    return response
  }
}

function getSafeErrorCode(error: unknown) {
  return error instanceof Error && /^meta_marketing_[a-z0-9_]+$/.test(error.message)
    ? error.message
    : 'meta_marketing_connect_failed'
}
