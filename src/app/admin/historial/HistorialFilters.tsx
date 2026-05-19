'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Catalogo = { value: string; label: string }

export type HistorialFiltersState = {
  entidad: string
  accion: string
  usuario: string
  desde: string
  hasta: string
}

const ENTIDADES: Catalogo[] = [
  { value: '', label: 'Todas' },
  { value: 'rollo', label: 'Rollos' },
  { value: 'pedido', label: 'Pedidos' },
  { value: 'pedido_rollo', label: 'Asignaciones de rollo' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'muestra', label: 'Muestras' },
]

const ACCIONES: Catalogo[] = [
  { value: '', label: 'Todas' },
  { value: 'crear', label: 'Creación' },
  { value: 'actualizar', label: 'Actualización' },
  { value: 'cambiar_estado', label: 'Cambio de estado' },
  { value: 'auditar', label: 'Auditoría' },
  { value: 'asignar_rollo', label: 'Asignar rollo' },
  { value: 'desasignar_rollo', label: 'Desasignar rollo' },
  { value: 'pickear', label: 'Picking' },
  { value: 'eliminar', label: 'Eliminación' },
]

export default function HistorialFilters({
  current,
  usuarios,
}: {
  current: HistorialFiltersState
  usuarios: Array<{ id: string; nombre: string }>
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
      router.replace(qs ? `/admin/historial?${qs}` : '/admin/historial')
    })
  }

  function reset() {
    startTransition(() => {
      router.replace('/admin/historial')
    })
  }

  const hasFilters =
    !!current.entidad ||
    !!current.accion ||
    !!current.usuario ||
    !!current.desde ||
    !!current.hasta

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
            Entidad
          </label>
          <select
            value={current.entidad}
            onChange={(e) => update('entidad', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            {ENTIDADES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Acción
          </label>
          <select
            value={current.accion}
            onChange={(e) => update('accion', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            {ACCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Usuario
          </label>
          <select
            value={current.usuario}
            onChange={(e) => update('usuario', e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
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
      <p className="text-xs text-muted-foreground">
        {pending ? 'Aplicando filtros…' : 'Los filtros se aplican al cambiar.'}
      </p>
    </div>
  )
}
