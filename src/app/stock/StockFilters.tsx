'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Catalogo = { id: string; nombre: string }

export type StockFiltersState = {
  q: string
  articulo: string
  color: string
  tintoreria: string
  ubicacion: string
  estado: string
}

export default function StockFilters({
  articulos,
  tintorerias,
  current,
}: {
  articulos: Catalogo[]
  tintorerias: Catalogo[]
  current: StockFiltersState
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(field: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(field, value)
    else params.delete(field)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/stock?${qs}` : '/stock')
    })
  }

  function reset() {
    startTransition(() => {
      router.replace('/stock')
    })
  }

  const hasFilters =
    !!current.q ||
    !!current.articulo ||
    !!current.color ||
    !!current.tintoreria ||
    !!current.ubicacion ||
    current.estado !== 'en_stock'

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Buscar pieza
          </label>
          <input
            type="text"
            defaultValue={current.q}
            onBlur={(e) => {
              if (e.target.value !== current.q) update('q', e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                update('q', (e.target as HTMLInputElement).value)
              }
            }}
            placeholder="Ej. 12345"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Artículo
          </label>
          <select
            value={current.articulo}
            onChange={(e) => update('articulo', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Color
          </label>
          <input
            type="text"
            defaultValue={current.color}
            onBlur={(e) => {
              if (e.target.value !== current.color)
                update('color', e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                update('color', (e.target as HTMLInputElement).value)
              }
            }}
            placeholder="Ej. Negro"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Tintorería
          </label>
          <select
            value={current.tintoreria}
            onChange={(e) => update('tintoreria', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas</option>
            {tintorerias.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Ubicación
          </label>
          <input
            type="text"
            defaultValue={current.ubicacion}
            onBlur={(e) => {
              if (e.target.value !== current.ubicacion)
                update('ubicacion', e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                update('ubicacion', (e.target as HTMLInputElement).value)
              }
            }}
            placeholder="Ej. A42"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <select
            value={current.estado}
            onChange={(e) => update('estado', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="en_stock">En stock</option>
            <option value="segunda">Segunda</option>
            <option value="reservado">Reservado</option>
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="baja">Baja</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {pending
            ? 'Aplicando filtros…'
            : 'Los filtros se aplican al salir del campo o presionar Enter.'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </form>
  )
}
