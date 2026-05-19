'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toggleClienteActivo } from '../actions'

export default function ClienteActions({
  clienteId,
  activo,
}: {
  clienteId: string
  activo: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleClienteActivo(clienteId, !activo)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        activo
          ? 'Cliente desactivado. No va a aparecer en el dropdown de nuevos pedidos.'
          : 'Cliente reactivado.'
      )
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">
          {activo ? 'Cliente activo' : 'Cliente desactivado'}
        </p>
        <p className="text-xs text-muted-foreground">
          {activo
            ? 'Aparece en el catálogo para crear pedidos nuevos.'
            : 'Los pedidos viejos se mantienen. No aparece en el dropdown.'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          activo
            ? 'border border-destructive/40 text-destructive hover:bg-destructive/5'
            : 'bg-success text-success-foreground hover:opacity-90'
        }`}
      >
        {pending ? '…' : activo ? 'Desactivar' : 'Reactivar'}
      </button>
    </div>
  )
}
