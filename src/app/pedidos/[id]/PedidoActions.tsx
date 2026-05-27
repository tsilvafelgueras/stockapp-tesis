'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  cancelarPedido,
  confirmarEgresoPedido,
  entregarPedido,
} from '../actions'

type Mode =
  | 'view'
  | 'confirmar-cancelar'
  | 'confirmar-entregar'
  | 'confirmar-egreso'
  | 'caer-egreso'

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

  // El picking terminó (estado `lista`) → ventas confirma el egreso cuando
  // la mercadería efectivamente sale del depósito.
  const puedeConfirmarEgreso = esVentasOAdmin && estado === 'lista'

  // Si la mercadería estaba lista pero no terminó saliendo (cliente se cayó),
  // "Caer egreso" libera los rollos a stock.
  const puedeCaerEgreso = esVentasOAdmin && estado === 'lista'

  // Cancelar pedido normal (antes de que termine el picking, o ya con egreso
  // confirmado si se da de baja después).
  const puedeCancelar =
    esVentasOAdmin &&
    (estado === 'pendiente' ||
      estado === 'en_preparacion' ||
      estado === 'confirmada_egreso')

  // Admin entrega solo si ya se confirmó el egreso.
  const puedeEntregar = role === 'admin' && estado === 'confirmada_egreso'

  if (
    !puedeCancelar &&
    !puedeEntregar &&
    !puedeConfirmarEgreso &&
    !puedeCaerEgreso
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

  function handleCaerEgreso() {
    startTransition(async () => {
      const res = await cancelarPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        'Egreso dado de baja. Los rollos volvieron a estar disponibles en stock.'
      )
      setMode('view')
      router.refresh()
    })
  }

  function handleConfirmarEgreso() {
    startTransition(async () => {
      const res = await confirmarEgresoPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Egreso confirmado. Listo para entregar.')
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
          El picking terminó. Cuando la mercadería efectivamente sale, ventas
          confirma el egreso. Si no llega a salir, &quot;Caer egreso&quot; libera los
          rollos a stock.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {puedeConfirmarEgreso && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-egreso')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Confirmar egreso
          </button>
        )}
        {puedeCaerEgreso && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('caer-egreso')}
            className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Caer egreso
          </button>
        )}
        {puedeEntregar && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-entregar')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Marcar como entregado
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

      {mode === 'confirmar-egreso' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            Confirmás que la mercadería <strong>efectivamente salió</strong> del
            depósito. El pedido pasa a estado{' '}
            <strong>&ldquo;Egreso confirmado&rdquo;</strong> y administración va a poder
            marcarlo como entregado.
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
              onClick={handleConfirmarEgreso}
              disabled={pending}
              className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Confirmando…' : 'Sí, confirmar egreso'}
            </button>
          </div>
        </div>
      )}

      {mode === 'caer-egreso' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            El egreso se cae. Los rollos van a{' '}
            <strong>volver a estar disponibles en stock</strong> y el pedido
            queda como cancelado.
          </p>
          <p className="text-xs text-muted-foreground">
            Usá esto cuando el picking ya terminó pero la mercadería no llegó a
            salir.
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
              onClick={handleCaerEgreso}
              disabled={pending}
              className="rounded-md bg-destructive text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? 'Liberando…' : 'Sí, caer el egreso'}
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
