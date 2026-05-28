'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import SearchableCombobox from '@/components/SearchableCombobox'
import { UBICACIONES } from '@/lib/ubicaciones'

type Catalogo = { id: string; nombre: string }

export type StockFiltersState = {
  q: string
  articulo: string
  color: string
  lote: string
  tintoreria: string
  ubicacion: string
  estado: string
  orden: string
}

export const ORDEN_OPCIONES: { value: string; label: string }[] = [
  { value: 'reciente', label: 'Ingreso (mas reciente primero)' },
  { value: 'antiguo', label: 'Ingreso (mas antiguo primero)' },
  { value: 'kilos_desc', label: 'Kilos (mayor a menor)' },
  { value: 'kilos_asc', label: 'Kilos (menor a mayor)' },
  { value: 'articulo_asc', label: 'Articulo (A-Z)' },
  { value: 'articulo_desc', label: 'Articulo (Z-A)' },
]

const UBICACION_OPTIONS = UBICACIONES.map((u) => ({ value: u, label: u }))

export default function StockFilters({
  articulos,
  tintorerias,
  colores,
  lotes,
  current,
}: {
  articulos: Catalogo[]
  tintorerias: Catalogo[]
  colores: Catalogo[]
  lotes: string[]
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
    !!current.lote ||
    !!current.tintoreria ||
    !!current.ubicacion ||
    current.estado !== 'en_stock' ||
    current.orden !== 'reciente'

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-4 rounded-lg border bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Search className="size-4 text-action" />
        <h2 className="text-sm font-semibold">Filtros de stock</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Buscar pieza">
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
        </Field>

        <Field label="Articulo">
          <select
            value={current.articulo}
            onChange={(e) => update('articulo', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Color">
          <select
            value={current.color}
            onChange={(e) => update('color', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {colores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Lote">
          <select
            value={current.lote}
            onChange={(e) => update('lote', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {lotes.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tintoreria">
          <select
            value={current.tintoreria}
            onChange={(e) => update('tintoreria', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {tintorerias.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ubicacion">
          <SearchableCombobox
            value={current.ubicacion}
            onChange={(value) => update('ubicacion', value)}
            options={withCurrentUbicacion(current.ubicacion)}
            placeholder="Todas"
            searchPlaceholder="Buscar ubicacion..."
            emptyLabel="No hay ubicaciones"
          />
        </Field>

        <Field label="Estado">
          <select
            value={current.estado}
            onChange={(e) => update('estado', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="en_stock">En stock</option>
            <option value="segunda">Segunda</option>
            <option value="reservado">Reservado</option>
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="baja">Baja</option>
            <option value="todos">Todos</option>
          </select>
        </Field>

        <Field label="Ordenar por">
          <select
            value={current.orden}
            onChange={(e) => update('orden', e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            {ORDEN_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {pending
            ? 'Aplicando filtros...'
            : 'Se aplican al salir del campo o presionar Enter.'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-action/40 hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            Limpiar filtros
          </button>
        )}
      </div>
    </form>
  )
}

function withCurrentUbicacion(current: string) {
  if (!current || UBICACION_OPTIONS.some((o) => o.value === current)) {
    return UBICACION_OPTIONS
  }
  return [{ value: current, label: current }, ...UBICACION_OPTIONS]
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
