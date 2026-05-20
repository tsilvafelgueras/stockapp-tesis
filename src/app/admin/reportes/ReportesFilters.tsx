'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Catalogo = { id: string; nombre: string }

export type ReportesFiltersState = {
  anio: string
  meses: string[]
  tintorerias: string[]
  articulos: string[]
  dias: string
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

  const hasFilters =
    current.anio !== String(anioActual) ||
    current.meses.length > 0 ||
    current.tintorerias.length > 0 ||
    current.articulos.length > 0 ||
    (!!current.dias && current.dias !== '30')

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filtros</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Año">
          <select
            value={current.anio}
            onChange={(e) => update('anio', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
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
          <MultiSelect
            values={current.meses}
            options={MESES}
            onChange={(values) => update('mes', values)}
          />
        </Field>

        <Field label="Tintorerías">
          <MultiSelect
            values={current.tintorerias}
            options={tintorerias.map((t) => ({ value: t.id, label: t.nombre }))}
            onChange={(values) => update('tintoreria', values)}
          />
        </Field>

        <Field label="Artículos">
          <MultiSelect
            values={current.articulos}
            options={articulos.map((a) => ({ value: a.id, label: a.nombre }))}
            onChange={(values) => update('articulo', values)}
          />
        </Field>

        <Field label="Días en mano">
          <select
            value={current.dias || '30'}
            onChange={(e) => update('dias', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            {[7, 15, 30, 60, 90, 180].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {pending
          ? 'Aplicando filtros...'
          : 'Podés combinar varios meses, tintorerías y artículos en el mismo reporte.'}
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
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function MultiSelect({
  values,
  options,
  onChange,
}: {
  values: string[]
  options: { value: string; label: string }[]
  onChange: (values: string[]) => void
}) {
  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="max-h-32 overflow-y-auto rounded-md border bg-white p-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-accent"
        >
          <input
            type="checkbox"
            checked={values.includes(option.value)}
            onChange={() => toggle(option.value)}
            className="size-4 accent-action"
          />
          <span className="min-w-0 truncate">{option.label}</span>
        </label>
      ))}
    </div>
  )
}
