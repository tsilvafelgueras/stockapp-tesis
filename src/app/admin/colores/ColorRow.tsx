'use client'

import { useTransition } from 'react'
import { toggleColorActivo } from './actions'

export default function ColorRow({
  id,
  nombre,
  activo,
}: {
  id: string
  nombre: string
  activo: boolean
}) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      await toggleColorActivo(id, !activo)
    })
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{nombre}</td>
      <td className="px-4 py-3">
        {activo ? (
          <span className="text-xs text-success">Activo</span>
        ) : (
          <span className="text-xs text-muted-foreground">Inactivo</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {pending ? '...' : activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  )
}
