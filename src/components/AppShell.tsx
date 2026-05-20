'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Clock3,
  Factory,
  History,
  Home,
  Menu,
  PackagePlus,
  ScanLine,
  Scissors,
  Search,
  ShoppingCart,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import BrandMark from './BrandMark'
import LogoutButton from './LogoutButton'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  disabled?: boolean
  comingSoon?: string
}

export type NavSection = {
  title?: string
  items: NavItem[]
}

type Role = 'operario' | 'ventas' | 'admin' | 'super'

function homeHref(role: Role): string {
  switch (role) {
    case 'operario':
      return '/operario/dashboard'
    case 'ventas':
      return '/ventas/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'super':
      return '/super'
  }
}

function navForRole(role: Role): NavSection[] {
  if (role === 'super') {
    return [
      {
        items: [{ href: '/super', label: 'Empresas', icon: Building2 }],
      },
    ]
  }

  if (role === 'operario') {
    return [
      {
        items: [
          { href: '/operario/dashboard', label: 'Inicio', icon: Home },
          { href: '/operario/ingresos', label: 'Ingresos', icon: PackagePlus },
          { href: '/operario/confirmar', label: 'Confirmar llegadas', icon: ScanLine },
          { href: '/stock', label: 'Stock', icon: Search },
          { href: '/operario/picking', label: 'Picking', icon: ClipboardCheck },
          { href: '/operario/muestras', label: 'Muestras', icon: Scissors },
        ],
      },
    ]
  }

  if (role === 'ventas') {
    return [
      {
        items: [
          { href: '/ventas/dashboard', label: 'Inicio', icon: Home },
          { href: '/stock', label: 'Stock', icon: Search },
          { href: '/ventas/pedidos', label: 'Pedidos', icon: ShoppingCart },
          { href: '/ventas/pedidos-pendientes', label: 'Demandas', icon: Clock3 },
          { href: '/ventas/clientes', label: 'Clientes', icon: Users },
        ],
      },
    ]
  }

  return [
    {
      items: [{ href: '/admin/dashboard', label: 'Inicio', icon: Home }],
    },
    {
      title: 'Operacion',
      items: [
        { href: '/operario/ingresos', label: 'Ingresos', icon: PackagePlus },
        { href: '/operario/confirmar', label: 'Confirmar llegadas', icon: ScanLine },
        { href: '/operario/picking', label: 'Picking', icon: ClipboardCheck },
        { href: '/operario/muestras', label: 'Muestras', icon: Scissors },
      ],
    },
    {
      title: 'Ventas',
      items: [
        { href: '/stock', label: 'Stock', icon: Search },
        { href: '/ventas/pedidos', label: 'Pedidos', icon: ShoppingCart },
        { href: '/ventas/pedidos-pendientes', label: 'Demandas', icon: Clock3 },
        { href: '/ventas/clientes', label: 'Clientes', icon: Users },
      ],
    },
    {
      title: 'Administracion',
      items: [
        { href: '/admin/articulos', label: 'Articulos', icon: Boxes },
        { href: '/admin/tintorerias', label: 'Tintorerias', icon: Factory },
        { href: '/admin/equipo', label: 'Equipo', icon: Users },
        { href: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
        { href: '/admin/historial', label: 'Historial', icon: History },
      ],
    },
  ]
}

const ROLE_LABEL: Record<Role, string> = {
  super: 'Super-admin',
  admin: 'Administrador',
  operario: 'Operario',
  ventas: 'Ventas',
}

export default function AppShell({
  role,
  userName,
  empresaNombre,
  children,
}: {
  role: Role
  userName: string
  empresaNombre: string | null
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sections = navForRole(role)
  const home = homeHref(role)

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-sidebar px-3 text-sidebar-foreground shadow-sm md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex size-11 items-center justify-center rounded-md bg-white/10 active:bg-white/20"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>

        <Link href={home} className="min-w-0 flex-1">
          <BrandLockup empresaNombre={empresaNombre} compact />
        </Link>
      </header>

      <SidebarContent
        sections={sections}
        empresaNombre={empresaNombre}
        userName={userName}
        roleLabel={ROLE_LABEL[role]}
        home={home}
        className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      />

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 flex w-[18rem] max-w-[88vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <BrandLockup empresaNombre={empresaNombre} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-10 items-center justify-center rounded-md bg-white/10 active:bg-white/20"
                aria-label="Cerrar menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarContent
              sections={sections}
              empresaNombre={empresaNombre}
              userName={userName}
              roleLabel={ROLE_LABEL[role]}
              home={home}
              onItemClick={() => setDrawerOpen(false)}
              className="flex min-h-0 flex-1 flex-col"
              hideHeader
            />
          </div>
        </div>
      )}

      <main className="min-w-0 bg-background">{children}</main>
    </div>
  )
}

function BrandLockup({
  empresaNombre,
  compact,
}: {
  empresaNombre: string | null
  compact?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="size-10 shadow-sm" />
      <div className="min-w-0">
        <p className="font-heading text-[1.375rem] font-bold leading-none tracking-normal">
          NUDO
        </p>
        <p className="mt-1 truncate text-[11px] text-white/68">
          {compact ? empresaNombre ?? 'Gestion textil' : empresaNombre ?? 'WMS textil'}
        </p>
      </div>
    </div>
  )
}

function SidebarContent({
  sections,
  empresaNombre,
  userName,
  roleLabel,
  home,
  className,
  hideHeader,
  onItemClick,
}: {
  sections: NavSection[]
  empresaNombre: string | null
  userName: string
  roleLabel: string
  home: string
  className?: string
  hideHeader?: boolean
  onItemClick?: () => void
}) {
  const pathname = usePathname()

  return (
    <aside className={className}>
      {!hideHeader && (
        <Link href={home} className="border-b border-sidebar-border px-5 py-5">
          <BrandLockup empresaNombre={empresaNombre} />
        </Link>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections.map((section, i) => (
            <div key={i} className="space-y-1">
              {section.title && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/48">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon
                const active =
                  pathname === item.href ||
                  (item.href !== home && pathname.startsWith(item.href + '/'))

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-white/35"
                      title={item.comingSoon}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-action text-action-foreground shadow-sm'
                        : 'text-white/78 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-lg bg-white/8 p-3">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="mt-0.5 text-xs text-white/55">{roleLabel}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  )
}
