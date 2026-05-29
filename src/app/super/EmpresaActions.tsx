'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setEmpresaActivo, iniciarImpersonacion } from './actions'

export default function EmpresaActions({
  empresaId,
  activo,
  nombre,
}: {
  empresaId: string
  activo: boolean
  nombre: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [operando, startOperando] = useTransition()
  const [confirmando, setConfirmando] = useState(false)

  function handleToggle(nuevoActivo: boolean) {
    startTransition(async () => {
      const res = await setEmpresaActivo(empresaId, nuevoActivo)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        nuevoActivo
          ? `Empresa "${nombre}" reactivada.`
          : `Empresa "${nombre}" pausada. Sus usuarios no podrán entrar.`
      )
      setConfirmando(false)
      router.refresh()
    })
  }

  function handleOperar() {
    startOperando(async () => {
      const res = await iniciarImpersonacion(empresaId)
      // iniciarImpersonacion redirige a /admin/dashboard cuando hay éxito,
      // así que solo llegamos acá si falló.
      if (res?.error) {
        toast.error(res.error)
      }
    })
  }

  if (activo) {
    if (!confirmando) {
      return (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleOperar}
            disabled={operando}
            className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1 hover:opacity-90 disabled:opacity-50 transition-opacity"
            title={`Entrar a operar como super-admin dentro de ${nombre}`}
          >
            {operando ? 'Entrando…' : 'Operar'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="text-xs rounded-md border border-warning/40 text-warning px-3 py-1 hover:bg-warning/5 transition-colors"
          >
            Pausar
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">¿Pausar?</span>
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={pending}
          className="rounded-md bg-warning text-warning-foreground px-2 py-1 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : 'Sí'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={pending}
          className="rounded-md border px-2 py-1 hover:bg-zinc-50 disabled:opacity-50"
        >
          No
        </button>
      </div>
    )
  }

  // Inactiva → solo botón reactivar
  return (
    <button
      type="button"
      onClick={() => handleToggle(true)}
      disabled={pending}
      className="text-xs rounded-md bg-success text-success-foreground px-3 py-1 hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Reactivando…' : 'Reactivar'}
    </button>
  )
}
