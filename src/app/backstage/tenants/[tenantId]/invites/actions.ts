'use server'

import { createSignupInvite } from '@/lib/platform/invites'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type CreateInviteState = {
  ok: boolean
  message: string
  inviteUrl?: string
}

const createInviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().trim().email(),
  role: z.enum(['owner', 'admin', 'operator', 'analyst', 'viewer']),
})

export async function createInviteAction(
  _previousState: CreateInviteState,
  formData: FormData
): Promise<CreateInviteState> {
  const platformAdmin = await requirePlatformAdmin()
  const parsed = createInviteSchema.safeParse({
    tenantId: formData.get('tenant_id'),
    email: formData.get('email'),
    role: formData.get('role') || 'owner',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
  }

  const admin = createAdminClient()
  const invite = await createSignupInvite(admin, {
    theatreId: parsed.data.tenantId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: platformAdmin.user.id,
  })

  if (!invite.ok) {
    return { ok: false, message: invite.error }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  revalidatePath(`/backstage/tenants/${parsed.data.tenantId}/invites`)

  return {
    ok: true,
    message: 'Invitación creada. Copia este enlace ahora; el token no se guarda en claro.',
    inviteUrl: `${appUrl}/signup?invite=${invite.token}`,
  }
}
