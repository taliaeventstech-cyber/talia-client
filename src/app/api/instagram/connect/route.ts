import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getInstagramAuthorizationUrl } from '@/lib/instagram/oauth'
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
      'manage_instagram',
      'instagram',
    )
    const authorizationUrl = getInstagramAuthorizationUrl({
      tenantId: tenantId!,
      userId: access.userId,
    })
    return NextResponse.redirect(authorizationUrl)
  } catch (error) {
    console.error('[instagram-oauth] connect failed', {
      tenantId,
      code: getSafeErrorCode(error),
    })
    return NextResponse.redirect(
      new URL(`/${tenantId}/overview?instagram_error=oauth_config`, request.url),
    )
  }
}

function getSafeErrorCode(error: unknown) {
  return error instanceof Error && /^instagram_[a-z0-9_]+$/.test(error.message)
    ? error.message
    : 'instagram_connect_failed'
}
