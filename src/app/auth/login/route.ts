import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-login]', error?.message || 'No user returned from Supabase Auth')
    }

    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('users')
    .select('theatre_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (member) {
    return NextResponse.json({ redirectTo: `/${member.theatre_id}/overview` })
  }

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle()

  return NextResponse.json({ redirectTo: platformAdmin ? '/backstage' : '/onboarding' })
}
