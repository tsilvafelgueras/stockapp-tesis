'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { confirmarEgresoPedido } from '@/app/pedidos/actions'

export default function ConfirmarEgresoCard({ pedidoId }: { pedidoId: string }) {
  const router = useRouter()
  const [comentario, setComentario] = useState('')
  const [remitoSalida, setRemitoSalida] = useState('')
  const [pending, startTransition] = useTransition()

  function confirmar() {
    startTransition(async () => {
      const res = await confirmarEgresoPedido(pedidoId, comentario, remitoSalida)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Egreso confirmado.')
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div>
        <h2 className="font-semibold">Pedido listo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposito ya pickeo todos los rollos. Confirmar egreso registra que la
          mercaderia salio fisicamente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nro remito de salida">
          <input
            type="text"
            value={remitoSalida}
            onChange={(e) => setRemitoSalida(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Comentario">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="Opcional"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Confirmando...' : 'Confirmar egreso'}
        </button>
      </div>
    </section>
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
