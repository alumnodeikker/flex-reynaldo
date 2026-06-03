'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, Crown, User, ShieldCheck, QrCode, LayoutDashboard, ChevronUp } from 'lucide-react'
import FlexLogo from '@/components/FlexLogo'

const NAV_CLIENTE = [
  { icon: ShoppingCart, label: 'Pedir',     href: '/' },
  { icon: Crown,        label: 'Salas VIP', href: '/vip' },
  { icon: User,         label: 'Mi área',   href: '/mi-area' },
]

const NAV_STAFF = [
  { icon: ShieldCheck,     label: 'Panel Staff', href: '/staff',    roles: ['staff', 'admin'] },
  { icon: QrCode,          label: 'Porteros',    href: '/porteros', roles: ['portero', 'staff', 'admin'] },
  { icon: LayoutDashboard, label: 'Admin',       href: '/admin',    roles: ['admin'] },
]

function NavGroup({ title, items, pathname }) {
  return (
    <div className="mb-2">
      <p className="px-3 mb-1 text-xs font-semibold text-zinc-600 uppercase tracking-wider">{title}</p>
      {items.map(({ icon: Icon, label, href }) => {
        const activo = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activo
                ? 'bg-gold-500/20 text-gold-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

const LABEL_ROL = { cliente: 'Cliente', staff: 'Staff', portero: 'Portero', admin: 'Admin' }

export default function Sidebar({ rol, nombre }) {
  const pathname = usePathname()
  const itemsGestion = NAV_STAFF.filter(i => i.roles.includes(rol))

  return (
    <aside className="w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-6 py-6 border-b border-zinc-800">
        <FlexLogo className="h-10 w-auto" />
      </div>

      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        <NavGroup title="Cliente" items={NAV_CLIENTE} pathname={pathname} />
        {itemsGestion.length > 0 && (
          <NavGroup title="Gestión" items={itemsGestion} pathname={pathname} />
        )}
      </nav>

      <Link
        href="/perfil"
        className="px-4 py-4 border-t border-zinc-800 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors w-full text-left group"
      >
        <div className="w-8 h-8 rounded-full bg-gold-500/30 flex items-center justify-center text-gold-400 text-sm font-bold shrink-0">
          {nombre?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{nombre}</p>
          <p className="text-xs text-zinc-500">{LABEL_ROL[rol] ?? 'Cliente'}</p>
        </div>
        <ChevronUp size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </Link>
    </aside>
  )
}
