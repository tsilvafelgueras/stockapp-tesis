'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import ExcelFilter from '@/components/ExcelFilter'

type Catalogo = { id: string; nombre: string }

export type ReportesFiltersState = {
  anio: string
  meses: string[]
  tintorerias: string[]
  articulos: string[]
  desde: string
  hasta: string
}

const MESES = [
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
  anios: number[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(field: string, value: string | string[]) {
    const params = new URLSearchParams(sp.toString())
    const next = Array.isArray(value) ? value.filter(Boolean).join(',') : value
    if (next) params.set(field, next)
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

  const rangoActivo = !!current.desde && !!current.hasta

  const hasFilters =
    current.anio !== String(anioActual) ||
    current.meses.length > 0 ||
    current.tintorerias.length > 0 ||
    current.articulos.length > 0 ||
    !!current.desde ||
    !!current.hasta

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-action" />
          <h2 className="text-sm font-semibold">Filtros</h2>
          {pending && (
            <span className="text-xs text-muted-foreground">Aplicando…</span>
          )}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-action/40 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Field label="Año">
          <select
            value={current.anio}
            onChange={(e) => update('anio', e.target.value)}
            disabled={rangoActivo}
            className="h-9 w-28 rounded-md border bg-white px-2 text-sm disabled:opacity-50"
          >
            {aniosOpciones
              .sort((a, b) => b - a)
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Meses">
          <div className={rangoActivo ? 'pointer-events-none opacity-50' : ''}>
            <ExcelFilter
              label="Meses"
              options={MESES}
              selected={current.meses}
              onChange={(values) => update('mes', values)}
            />
          </div>
        </Field>

        <Field label="Tintorerías">
          <ExcelFilter
            label="Tintorerías"
            options={tintorerias.map((t) => ({ value: t.id, label: t.nombre }))}
            selected={current.tintorerias}
            onChange={(values) => update('tintoreria', values)}
          />
        </Field>

        <Field label="Artículos">
          <ExcelFilter
            label="Artículos"
            options={articulos.map((a) => ({ value: a.id, label: a.nombre }))}
            selected={current.articulos}
            onChange={(values) => update('articulo', values)}
          />
        </Field>

        <span className="mx-1 hidden h-9 w-px self-end bg-border sm:block" />

        <Field label="Desde">
          <input
            type="date"
            value={current.desde}
            max={current.hasta || undefined}
            onChange={(e) => update('desde', e.target.value)}
            className="h-9 rounded-md border bg-white px-2 text-sm"
          />
        </Field>
        <Field label="Hasta">
          <input
            type="date"
            value={current.hasta}
            min={current.desde || undefined}
            onChange={(e) => update('hasta', e.target.value)}
            className="h-9 rounded-md border bg-white px-2 text-sm"
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {rangoActivo
          ? 'Rango de fechas activo: reemplaza el filtro de año y meses.'
          : 'Podés combinar varios meses, tintorerías y artículos. Un rango de fechas reemplaza año/meses.'}
      </p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
