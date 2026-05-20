'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  cancelarPedido,
  confirmarVentaPedido,
  entregarPedido,
} from '../actions'

type Mode =
  | 'view'
  | 'confirmar-cancelar'
  | 'confirmar-entregar'
  | 'confirmar-venta'
  | 'caer-venta'

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

  const esVentasOAdmin = role === 'ventas' || role === 'admin'

  // El picking terminó (estado `lista`) → ventas debe confirmar la venta.
  const puedeConfirmarVenta = esVentasOAdmin && estado === 'lista'

  // Si la venta se cae mientras está en `lista` (picking listo pero venta no
  // se cerró), se "cae" la venta. Esto es funcionalmente lo mismo que
  // cancelar: libera rollos a en_stock.
  const puedeCaerVenta = esVentasOAdmin && estado === 'lista'

  // Cancelar pedido normal (antes de que termine el picking, o ya con venta
  // confirmada si se da de baja después).
  const puedeCancelar =
    esVentasOAdmin &&
    (estado === 'pendiente' ||
      estado === 'en_preparacion' ||
      estado === 'confirmada_venta')

  // Admin entrega solo si ya se confirmó la venta.
  const puedeEntregar = role === 'admin' && estado === 'confirmada_venta'

  if (
    !puedeCancelar &&
    !puedeEntregar &&
    !puedeConfirmarVenta &&
    !puedeCaerVenta
  )
    return null

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

  function handleCaerVenta() {
    startTransition(async () => {
      const res = await cancelarPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        'Venta dada de baja. Los rollos volvieron a estar disponibles en stock.'
      )
      setMode('view')
      router.refresh()
    })
  }

  function handleConfirmarVenta() {
    startTransition(async () => {
      const res = await confirmarVentaPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Venta confirmada. Listo para entregar.')
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
      {estado === 'lista' && mode === 'view' && (
        <p className="text-xs text-muted-foreground">
          El picking terminó. Ventas debe confirmar la venta para que admin
          pueda entregar. Si la venta se cae, &quot;Caer venta&quot; libera los rollos.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {puedeConfirmarVenta && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-venta')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Confirmar venta
          </button>
        )}
        {puedeCaerVenta && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('caer-venta')}
            className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Caer venta
          </button>
        )}
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

      {mode === 'confirmar-venta' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            Confirmás que la venta se cerró. El pedido pasa a estado{' '}
            <strong>&ldquo;Venta confirmada&rdquo;</strong> y administración va a poder
            entregarlo.
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
              onClick={handleConfirmarVenta}
              disabled={pending}
              className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Confirmando…' : 'Sí, confirmar venta'}
            </button>
          </div>
        </div>
      )}

      {mode === 'caer-venta' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            La venta se cae. Los rollos van a{' '}
            <strong>volver a estar disponibles en stock</strong> y el pedido
            queda como cancelado.
          </p>
          <p className="text-xs text-muted-foreground">
            Usá esto cuando el picking ya terminó pero el cliente no concretó la
            compra.
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
              onClick={handleCaerVenta}
              disabled={pending}
              className="rounded-md bg-destructive text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Liberando…' : 'Sí, caer la venta'}
            </button>
          </div>
        </div>
      )}

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
