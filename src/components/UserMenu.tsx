'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

const ROLE_LABEL: Record<Role, string> = {
  super: 'Super-admin',
  admin: 'Administrador',
  operario: 'Operario',
  ventas: 'Ventas',
}

function initials(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default function UserMenu({
  userName,
  role,
  empresaNombre,
}: {
  userName: string
  role: Role
  empresaNombre: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function handleLogout() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        aria-expanded={open}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action text-xs font-semibold text-action-foreground">
          {initials(userName)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight">
            {userName}
          </span>
          <span className="block text-[11px] leading-tight text-white/60">
            {ROLE_LABEL[role]}
          </span>
        </span>
        <ChevronDown className="hidden size-4 text-white/55 sm:block" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border bg-white text-foreground shadow-xl"
          role="menu"
        >
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            {empresaNombre && (
              <p className="mt-1 text-xs text-muted-foreground">
                {empresaNombre}
              </p>
            )}
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
