import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { BackstageNavigation } from './backstage-navigation'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePlatformAdmin()
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('auth_user_id', access.user.id)
    .maybeSingle()
  const email = profile?.email ?? access.user.email ?? 'Usuario de plataforma'
  const displayName = profile?.full_name?.trim() || getEmailDisplayName(email)
  const initials = getInitials(displayName)

  return (
    <div className="auth-shell backstage-shell">
      <aside className="backstage-sidebar">
        <Link className="backstage-brand" href="/backstage" aria-label="TALIA Backstage">
          <span className="backstage-brand-mark" aria-hidden="true" />
          <span>
            <strong>TALIA</strong>
            <small>Backstage</small>
          </span>
        </Link>

        <BackstageNavigation />

        <div className="backstage-sidebar-footer">
          <div className="backstage-profile-card">
            <span className="backstage-profile-avatar" aria-hidden="true">{initials}</span>
            <span className="backstage-profile-copy">
              <strong title={displayName}>{displayName}</strong>
              <small title={email}>{email}</small>
              <span className="backstage-admin-badge">
                <ShieldCheck aria-hidden="true" size={13} strokeWidth={2} />
                {getPlatformRoleLabel(access.role)}
              </span>
            </span>
          </div>
          <form action="/auth/logout" method="post">
            <button className="backstage-navigation-link" type="submit">
              <LogOut aria-hidden="true" size={18} strokeWidth={2} />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="backstage-main">
        <div className="backstage-content">{children}</div>
      </main>
    </div>
  )
}

function getEmailDisplayName(email: string) {
  const localPart = email.split('@')[0]?.trim()
  return localPart || 'Usuario de plataforma'
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return initials || 'TA'
}

function getPlatformRoleLabel(role: string) {
  if (role === 'owner') return 'Propietario de plataforma'
  if (role === 'admin') return 'Administrador de plataforma'
  if (role === 'support') return 'Soporte de plataforma'
  return role ? `Plataforma · ${role}` : 'Acceso de plataforma'
}
