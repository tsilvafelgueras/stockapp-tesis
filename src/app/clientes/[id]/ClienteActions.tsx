'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { eliminarCliente, toggleClienteActivo } from '../actions'

export default function ClienteActions({
  clienteId,
  activo,
}: {
  clienteId: string
  activo: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deletePending, startDelete] = useTransition()

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

  function handleEliminar() {
    if (!window.confirm('Eliminar este cliente?')) return
    startDelete(async () => {
      const res = await eliminarCliente(clienteId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Cliente eliminado.')
      router.push('/clientes')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">
          {activo ? 'Cliente activo' : 'Cliente desactivado'}
        </p>
        <p className="text-xs text-muted-foreground">
          {activo
            ? 'Aparece en el catalogo para crear pedidos nuevos.'
            : 'Los pedidos viejos se mantienen. No aparece en el dropdown.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending || deletePending}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            activo
              ? 'border border-destructive/40 text-destructive hover:bg-destructive/5'
              : 'bg-success text-success-foreground hover:opacity-90'
          }`}
        >
          {pending ? '...' : activo ? 'Desactivar' : 'Reactivar'}
        </button>
        <button
          type="button"
          onClick={handleEliminar}
          disabled={pending || deletePending}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
        >
          {deletePending ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
