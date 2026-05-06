import { createClient } from '@/lib/supabase/server'
import { getAuthCallbackUrl } from '@/lib/auth/callback-url'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const parsed = signupSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Introduce un email válido y una contraseña de al menos 8 caracteres.' },
      { status: 400 }
    )
  }

  const { email, password } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(request),
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (data.session?.user) {
    return NextResponse.json({ redirectTo: await getPostAuthRedirect(supabase, data.session.user.id) })
  }

  return NextResponse.json({
    status: 'confirmation_required',
    message: 'Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada antes de continuar.',
  })
}

async function getPostAuthRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: member } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', userId)
    .maybeSingle()

  return member ? `/${member.theatre_id}/overview` : '/onboarding'
}
