import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  redirectTo: z.string().optional(),
})

function getInternalRedirect(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const parsed = signupSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Introduce un email válido y una contraseña de al menos 8 caracteres.' },
      { status: 400 }
    )
  }

  const { password } = parsed.data
  const email = parsed.data.email.toLowerCase()
  const redirectTo = getInternalRedirect(parsed.data.redirectTo)
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    const alreadyExists = error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')

    return NextResponse.json(
      {
        error: alreadyExists
          ? 'Este email ya existe. Entra con login.'
          : error.message,
      },
      { status: 400 }
    )
  }

  const userId = data.user?.id

  if (!userId) {
    return NextResponse.json(
      { error: 'No se pudo crear la cuenta.' },
      { status: 400 }
    )
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        auth_user_id: userId,
        email,
        status: 'active',
      },
      { onConflict: 'auth_user_id' }
    )
    .select('id')
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? 'No se pudo crear el perfil de acceso.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password })

  if (sessionData.session?.user) {
    return NextResponse.json({ redirectTo: redirectTo ?? '/onboarding' })
  }

  const loginPath = redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : '/login'

  return NextResponse.json({
    redirectTo: loginPath,
    message: 'Cuenta creada. Entra con tu email y contraseña.',
  })
}
