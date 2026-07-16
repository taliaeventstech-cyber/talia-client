'use client'

import { Building2, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { href: '/backstage', label: 'Resumen', icon: LayoutDashboard, section: 'home' },
  { href: '/backstage/clients', label: 'Clientes', icon: Building2, section: 'clients' },
] as const

export function BackstageNavigation() {
  const pathname = usePathname()

  return (
    <nav className="backstage-navigation" aria-label="Navegación de Backstage">
      {navigation.map(({ href, label, icon: Icon, section }) => {
        const isActive = section === 'home'
          ? pathname === '/backstage'
          : pathname.startsWith('/backstage/clients') || pathname.startsWith('/backstage/tenants')

        return (
          <Link
            className={`backstage-navigation-link ${isActive ? 'backstage-navigation-link-active' : ''}`}
            href={href}
            key={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
