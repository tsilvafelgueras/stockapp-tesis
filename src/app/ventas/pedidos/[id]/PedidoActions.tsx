'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelarPedido, entregarPedido } from '../actions'

type Mode = 'view' | 'confirmar-cancelar' | 'confirmar-entregar'

export default function PedidoActions({
  pedidoId,
  estado,
  role,
}: {
  pedidoId: string
  estado: string
  role: 'ventas' | 'admin'
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('view')
  const [pending, startTransition] = useTransition()

  const puedeCancelar =
    (role === 'ventas' || role === 'admin') &&
    (estado === 'pendiente' ||
      estado === 'en_preparacion' ||
      estado === 'lista')
  const puedeEntregar = role === 'admin' && estado === 'lista'

  if (!puedeCancelar && !puedeEntregar) return null

  function handleCancelar() {
    startTransition(async () => {
      const res = await cancelarPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Pedido cancelado. Los rollos volvieron a stock.')
      setMode('view')
      router.refresh()
    })
  }

  function handleEntregar() {
    startTransition(async () => {
      const res = await entregarPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Pedido marcado como entregado.')
      setMode('view')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap gap-2">
        {puedeEntregar && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-entregar')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Marcar como entregada
          </button>
        )}
        {puedeCancelar && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-cancelar')}
            className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Cancelar pedido
          </button>
        )}
      </div>

      {mode === 'confirmar-cancelar' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            ¿Confirmás que querés cancelar este pedido? Los rollos van a volver
            a estar disponibles en stock.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMode('view')}
              disabled={pending}
              className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleCancelar}
              disabled={pending}
              className="rounded-md bg-destructive text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Cancelando…' : 'Sí, cancelar pedido'}
            </button>
          </div>
        </div>
      )}

      {mode === 'confirmar-entregar' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            ¿Marcamos el pedido como entregado al cliente? Los rollos pasan a
            estado &ldquo;Entregado&rdquo; y dejan de figurar en stock.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMode('view')}
              disabled={pending}
              className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleEntregar}
              disabled={pending}
              className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Marcando…' : 'Sí, marcar entregada'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
