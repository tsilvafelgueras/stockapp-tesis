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
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <nav
        className="flex min-w-max gap-1 border-b"
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
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-action text-action'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
