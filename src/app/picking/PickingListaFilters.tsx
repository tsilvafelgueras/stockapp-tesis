'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { estadoPedidoBadge } from '@/lib/estadoPedido'

export type PedidoListItem = {
  id: string
  numero_pedido: string | null
  cliente: string
  estado: string
  created_at: string
  pedido_partidas:
    | {
        id: string
        rollos_solicitados: number
        pedido_rollos: { id: string; liberado_at: string | null }[] | null
      }[]
    | null
}

export function PedidoCard({
  pedido,
  cta,
}: {
  pedido: PedidoListItem
  cta?: string
}) {
  const estado = estadoPedidoBadge(pedido.estado)
  const total =
    pedido.pedido_partidas?.reduce(
      (acc, pp) => acc + Number(pp.rollos_solicitados ?? 0),
      0
    ) ?? 0
  const pickeados =
    pedido.pedido_partidas?.reduce(
      (acc, pp) =>
        acc +
        (pp.pedido_rollos?.filter((pr) => pr.liberado_at == null).length ?? 0),
      0
    ) ?? 0
  const pct = total > 0 ? Math.round((pickeados / total) * 100) : 0

  return (
    <Link
      href={`/picking/${pedido.id}`}
      className="block rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{pedido.cliente}</p>
          <p className="text-xs text-muted-foreground">
            Pedido {pedido.numero_pedido ?? '-'} -{' '}
            {new Date(pedido.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${estado.className}`}
        >
          {cta ?? estado.text}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {pickeados} de {total} rollos pickeados
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  )
}

export default function PickingListaFilters({
  listos,
}: {
  listos: PedidoListItem[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'asc' | 'desc'>('desc')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    const resultado = q
      ? listos.filter(
          (p) =>
            p.cliente.toLowerCase().includes(q) ||
            (p.numero_pedido ?? '').toLowerCase().includes(q)
        )
      : listos
    return [...resultado].sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return orden === 'asc' ? diff : -diff
    })
  }, [listos, busqueda, orden])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente o N° pedido..."
          className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => setOrden((o) => (o === 'asc' ? 'desc' : 'asc'))}
          className="whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
        >
          {orden === 'asc' ? '↑ Más antiguos' : '↓ Más nuevos'}
        </button>
      </div>
      {filtrados.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Ningún pedido coincide con la búsqueda.
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => (
            <PedidoCard key={p.id} pedido={p} cta="Confirmar salida" />
          ))}
        </div>
      )}
    </div>
  )
}
