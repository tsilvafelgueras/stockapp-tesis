'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Catalogo = { id: string; nombre: string }

export type ReportesFiltersState = {
  anio: string
  mes: string
  tintoreria: string
  articulo: string
  dias: string
}

const MESES = [
  { value: '', label: 'Todo el año' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

export default function ReportesFilters({
  current,
  tintorerias,
  articulos,
  anios,
}: {
  current: ReportesFiltersState
  tintorerias: Catalogo[]
  articulos: Catalogo[]
  /** Lista de años con datos para el dropdown de Movimientos. */
  anios: number[]
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
      router.replace(qs ? `/admin/reportes?${qs}` : '/admin/reportes')
    })
  }

  function reset() {
    startTransition(() => {
      router.replace('/admin/reportes')
    })
  }

  const anioActual = new Date().getFullYear()
  const aniosOpciones = anios.includes(anioActual)
    ? anios
    : [anioActual, ...anios]

  const hasFilters =
    !!current.anio ||
    !!current.mes ||
    !!current.tintoreria ||
    !!current.articulo ||
    (!!current.dias && current.dias !== '30')

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filtros</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Año (Movimientos)
          </label>
          <select
            value={current.anio}
            onChange={(e) => update('anio', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="">Mes actual</option>
            {aniosOpciones
              .sort((a, b) => b - a)
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Mes (Movimientos)
          </label>
          <select
            value={current.mes}
            onChange={(e) => update('mes', e.target.value)}
            disabled={!current.anio}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white disabled:bg-zinc-50 disabled:cursor-not-allowed"
          >
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
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
            Días antigüedad
          </label>
          <select
            value={current.dias || '30'}
            onChange={(e) => update('dias', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            {[7, 15, 30, 60, 90, 180].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {pending ? 'Aplicando filtros…' : 'Los filtros se aplican al cambiar.'}
      </p>
    </div>
  )
}
