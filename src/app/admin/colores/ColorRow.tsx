'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { editarColor, eliminarColor } from './actions'

export default function ColorRow({
  id,
  nombre,
}: {
  id: string
  nombre: string
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmar'>('view')
  const [valor, setValor] = useState(nombre)
  const [pending, startTransition] = useTransition()

  function guardar() {
    const limpio = valor.trim()
    if (!limpio) {
      toast.error('El nombre no puede estar vacío.')
      return
    }
    if (limpio === nombre) {
      setMode('view')
      return
    }
    startTransition(async () => {
      const res = await editarColor(id, limpio)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Color actualizado.')
      setMode('view')
    })
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarColor(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Color "${nombre}" eliminado.`)
    })
  }

  if (mode === 'edit') {
    return (
      <tr className="border-b last:border-0 bg-accent/40">
        <td className="px-4 py-3">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                guardar()
              } else if (e.key === 'Escape') {
                setValor(nombre)
                setMode('view')
              }
            }}
            className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
          />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setValor(nombre)
                setMode('view')
              }}
              disabled={pending}
              className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (mode === 'confirmar') {
    return (
      <tr className="border-b last:border-0 bg-destructive/5">
        <td className="px-4 py-3 text-sm">
          ¿Eliminar el color <strong>{nombre}</strong>?
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('view')}
              disabled={pending}
              className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={pending}
              className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {pending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{nombre}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setMode('confirmar')}
            className="rounded-md border border-destructive/40 text-destructive px-3 py-1 text-xs hover:bg-destructive/5"
          >
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  )
}
