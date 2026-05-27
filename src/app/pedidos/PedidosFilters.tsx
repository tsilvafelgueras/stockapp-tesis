'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export type PedidosFiltersState = {
  estado: string
  cliente_id: string
  desde: string
  hasta: string
  q: string
}

const ESTADO_OPCIONES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'lista', label: 'Lista (esperando egreso)' },
  { value: 'confirmada_egreso', label: 'Egreso confirmado' },
  { value: 'entregada', label: 'Entregados' },
  { value: 'cancelada', label: 'Cancelados' },
]

export default function PedidosFilters({
  clientes,
  current,
}: {
  clientes: Array<{ id: string; nombre: string }>
  current: PedidosFiltersState
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
      router.replace(qs ? `/pedidos?${qs}` : '/pedidos')
    })
  }

  function reset() {
    startTransition(() => {
      router.replace('/pedidos')
    })
  }

  const hasFilters =
    !!current.cliente_id ||
    !!current.estado ||
    !!current.desde ||
    !!current.hasta ||
    !!current.q

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Buscar N° pedido / remito
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
            placeholder="Ej. 00012"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Cliente
          </label>
          <select
            value={current.cliente_id}
            onChange={(e) => update('cliente_id', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
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
            {ESTADO_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Desde
          </label>
          <input
            type="date"
            value={current.desde}
            onChange={(e) => update('desde', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Hasta
          </label>
          <input
            type="date"
            value={current.hasta}
            onChange={(e) => update('hasta', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {pending ? 'Aplicando filtros…' : 'Los filtros se aplican al cambiar.'}
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
    </div>
  )
}
