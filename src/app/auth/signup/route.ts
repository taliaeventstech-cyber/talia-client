import { createClient } from '@/lib/supabase/server'
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
  const origin = request.nextUrl.origin
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (data.session?.user) {
    return NextResponse.json({ redirectTo: await getPostAuthRedirect(supabase, data.session.user.id) })
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password })

  if (signIn.data.user) {
    return NextResponse.json({ redirectTo: await getPostAuthRedirect(supabase, signIn.data.user.id) })
  }

  if (!data.session) {
    return NextResponse.json({
      message: 'Revisa tu email para confirmar la cuenta antes de continuar.',
    })
  }

  return NextResponse.json({ redirectTo: '/onboarding' })
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
