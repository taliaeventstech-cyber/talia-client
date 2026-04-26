import { ensureUserMembership } from '@/lib/auth/membership'
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
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const member = await ensureUserMembership(data.user)

  if (!member) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'No se pudo preparar el acceso al dashboard' }, { status: 500 })
  }

  return NextResponse.json({ redirectTo: `/${member.theatre_id}/overview` })
}
