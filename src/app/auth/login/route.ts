import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPostAuthRedirectPath } from '@/lib/auth/post-auth-redirect'
import { checkRateLimit, getClientIp, getInternalRedirect, normalizeEmail } from '@/lib/auth/security'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password, redirectTo: requestedRedirectTo } = await request.json()

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 })
  }

  const normalizedEmail = normalizeEmail(email)
  const limited = checkRateLimit(request, [
    { key: `auth-login:ip:${getClientIp(request)}`, limit: 20 },
    { key: `auth-login:email:${normalizedEmail}`, limit: 8 },
  ])
  if (limited) return limited

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

  if (error || !data.user) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-login]', error?.message || 'No user returned from Supabase Auth')
    }

    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  const admin = createAdminClient()
  const redirectTo = await getPostAuthRedirectPath(admin, data.user.id)
  return NextResponse.json({ redirectTo: getInternalRedirect(requestedRedirectTo) ?? redirectTo })
}
