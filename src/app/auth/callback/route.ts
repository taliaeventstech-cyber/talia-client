import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { getInternalRedirect } from '@/lib/auth/security'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const admin = createAdminClient()
  const redirectPath = getInternalRedirect(searchParams.get('next')) ?? await getPostAuthRedirectPath(admin, user.id)
  return NextResponse.redirect(`${origin}/auth/confirmed?next=${encodeURIComponent(redirectPath)}`)
}
