'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { resolverPedidoPendiente, cancelarPedidoPendiente } from './actions'
import type { PedidoPendienteData } from './page'

function diasDesde(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function DiasBadge({ createdAt }: { createdAt: string }) {
  const dias = diasDesde(createdAt)
  const label = dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`
  const cls =
    dias < 3
      ? 'bg-success/15 text-success'
      : dias <= 7
        ? 'bg-warning/15 text-warning'
        : 'bg-destructive/15 text-destructive'
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cls}`}>
      {label}
    </span>
  )
}

export default function PedidoPendienteRow({
  pedido,
  readonly,
}: {
  pedido: PedidoPendienteData
  readonly?: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleResolver() {
    startTransition(async () => {
      const res = await resolverPedidoPendiente(pedido.id)
      if (!res.ok) toast.error(res.error)
      else toast.success(`Demanda de ${pedido.cliente} marcada como resuelta.`)
    })
  }

  function handleCancelar() {
    startTransition(async () => {
      const res = await cancelarPedidoPendiente(pedido.id)
      if (!res.ok) toast.error(res.error)
      else toast.success(`Demanda de ${pedido.cliente} cancelada.`)
    })
  }

  const estadoResuelto = pedido.estado === 'resuelto'
  const estadoCancelado = pedido.estado === 'cancelado'

  return (
    <div className={`p-4 space-y-2 ${readonly ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{pedido.cliente}</p>
          <p className="text-xs text-muted-foreground">
            {pedido.articulos?.nombre ?? 'Artículo no especificado'}
            {pedido.color ? ` · ${pedido.color}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!readonly && <DiasBadge createdAt={pedido.created_at} />}
          {readonly && (
            <span
              className={`text-xs rounded-full px-2 py-0.5 ${
                estadoResuelto
                  ? 'bg-success/15 text-success'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {estadoResuelto ? 'Resuelta' : 'Cancelada'}
            </span>
          )}
        </div>
      </div>

      {(pedido.metros_estimados || pedido.kilos_estimados || pedido.notas) && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {pedido.metros_estimados && (
            <span>{pedido.metros_estimados} m estimados</span>
          )}
          {pedido.kilos_estimados && (
            <span>{pedido.kilos_estimados} kg estimados</span>
          )}
          {pedido.notas && <span className="italic">{pedido.notas}</span>}
        </div>
      )}

      {!readonly && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleResolver}
            disabled={pending}
            className="rounded-md bg-success/10 text-success border border-success/30 px-3 py-1.5 text-xs font-medium hover:bg-success/20 disabled:opacity-50 transition-colors"
          >
            Marcar resuelta
          </button>
          <button
            type="button"
            onClick={handleCancelar}
            disabled={pending}
            className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
