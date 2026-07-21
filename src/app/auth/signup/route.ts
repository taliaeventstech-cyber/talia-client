import { createClient } from '@/lib/supabase/server'
import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { getLocale } from '@/lib/i18n/dictionaries'
import { checkRateLimit, getClientIp, getInternalRedirect, normalizeEmail, passwordSchema } from '@/lib/auth/security'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: passwordSchema,
  redirectTo: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const parsed = signupSchema.safeParse(payload)

  if (!parsed.success) {
    const weakPassword = parsed.error.issues.some((issue) => issue.path.includes('password'))

    return NextResponse.json(
      { error: weakPassword ? 'weak_password' : 'invalid_signup' },
      { status: 400 }
    )
  }

  const { password } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const redirectTo = getInternalRedirect(parsed.data.redirectTo)
  const limited = await checkRateLimit(request, [
    { key: `auth-signup:ip:${getClientIp(request)}`, limit: 8 },
    { key: `auth-signup:email:${email}`, limit: 3 },
  ])
  if (limited) return limited

  const supabase = await createClient()
  const callbackUrl = getAuthCallbackUrl(request)
  const emailRedirectTo = redirectTo
    ? `${callbackUrl}?next=${encodeURIComponent(redirectTo)}`
    : callbackUrl
  // Persist the locale the user picked in the signup UI (LOCALE_COOKIE) as user
  // metadata so Supabase email templates can branch on {{ .Data.lang }}.
  const lang = await getLocale()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { lang },
    },
  })

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-signup]', error.message)
    }

    const isProviderRateLimit = error.message.toLowerCase().includes('rate limit')

    return NextResponse.json(
      { error: isProviderRateLimit ? 'email_rate_limited' : 'signup_failed' },
      { status: isProviderRateLimit ? 429 : 400 }
    )
  }

  if (data.session?.user) return NextResponse.json({ redirectTo: redirectTo ?? '/onboarding' })

  return NextResponse.json({
    message: 'Te hemos enviado un email de confirmación. Abre el enlace para activar la cuenta.',
  })
}
