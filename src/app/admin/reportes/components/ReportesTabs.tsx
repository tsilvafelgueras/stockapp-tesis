'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { REPORTE_TABS } from './tabs'

/**
 * Barra de tabs. El tab activo vive en la URL (`?tab=`); cambiarlo conserva
 * el resto de los filtros activos. El contenido lo renderiza el server según
 * el tab (page.tsx), así solo corren las queries del bloque visible.
 */
export default function ReportesTabs({ active }: { active: string }) {
  const pathname = usePathname()
  const sp = useSearchParams()

  function hrefFor(slug: string): string {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', slug)
    return `${pathname}?${params.toString()}`
  }

  return (
    <nav
      className="flex w-full overflow-hidden rounded-lg border bg-white shadow-sm"
      aria-label="Secciones de reportes"
    >
      {REPORTE_TABS.map((tab) => {
        const isActive = tab.slug === active
        return (
          <Link
            key={tab.slug}
            href={hrefFor(tab.slug)}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-12 flex-1 items-center justify-center border-b-2 px-2 text-center text-sm leading-tight transition-colors ${
              isActive
                ? 'border-action bg-action/5 font-bold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
