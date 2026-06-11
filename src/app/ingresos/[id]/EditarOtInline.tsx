'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { actualizarOtIngreso } from '@/app/ingresos/otActions'

/**
 * Edición inline de la OT (partida de tintorería) desde el detalle del ingreso.
 * Operario y admin pueden editarla/agregarla una vez cargado el ingreso.
 */
export default function EditarOtInline({
  ingresoId,
  otInicial,
  puedeEditar,
}: {
  ingresoId: string
  otInicial: string | null
  puedeEditar: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(otInicial ?? '')
  const [actual, setActual] = useState<string | null>(otInicial ?? null)
  const [pending, startTransition] = useTransition()

  function guardar() {
    startTransition(async () => {
      const res = await actualizarOtIngreso(ingresoId, valor)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const nueva = valor.trim() || null
      setActual(nueva)
      setEditando(false)
      toast.success(nueva ? `OT actualizada a ${nueva}.` : 'OT borrada.')
    })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">OT (partida tintorería)</p>
      {editando ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Orden de trabajo"
            autoFocus
            className="min-w-0 flex-1 rounded border border-input bg-white px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setValor(actual ?? '')
              setEditando(false)
            }}
            disabled={pending}
            className="rounded border px-2.5 py-1 text-xs disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center gap-2">
          <p className="font-medium">{actual ?? '—'}</p>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => {
                setValor(actual ?? '')
                setEditando(true)
              }}
              className="text-xs font-medium text-action hover:underline"
            >
              {actual ? 'Editar' : 'Agregar'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
