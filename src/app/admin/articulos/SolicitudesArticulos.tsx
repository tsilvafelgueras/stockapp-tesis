'use client'

import { useState, useTransition } from 'react'
import { aprobarSolicitudArticulo } from './solicitudes-actions'

export default function SolicitudesArticulos({ solicitudes, esAdmin }: {
  solicitudes: { id: string; nombre_solicitado: string }[]
  esAdmin: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (!solicitudes.length) return null
  return <section id="solicitudes" className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
    <h2 className="font-semibold">Artículos pendientes de aprobación ({solicitudes.length})</h2>
    <p className="text-sm">Los ingresos conservan sus rollos. Al aprobar, el artículo queda disponible en el catálogo.</p>
    {solicitudes.map(sol => <div key={sol.id} className="flex items-center justify-between gap-3">
      <span className="text-sm">{sol.nombre_solicitado}</span>
      {esAdmin && <button type="button" disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        onClick={() => startTransition(async () => {
          setError(null)
          try {
            const result = await aprobarSolicitudArticulo(sol.id)
            if (result.error) setError(result.error)
          } catch { setError('No se pudo aprobar el artículo. Volvé a intentar.') }
        })}>Aprobar artículo</button>}
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
