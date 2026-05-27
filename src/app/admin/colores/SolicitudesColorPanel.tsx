'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { aprobarSolicitudColor, rechazarSolicitudColor } from './actions'

type Solicitud = {
  id: string
  nombre_solicitado: string
  motivo: string | null
  created_at: string
  solicitante: string | null
}

export default function SolicitudesColorPanel({
  solicitudes: initial,
}: {
  solicitudes: Solicitud[]
}) {
  const [solicitudes, setSolicitudes] = useState(initial)
  const [rechazandoId, setRechazandoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pending, startTransition] = useTransition()

  function aprobar(id: string, nombre: string) {
    startTransition(async () => {
      const res = await aprobarSolicitudColor(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Color "${nombre}" aprobado y agregado al catálogo.`)
      setSolicitudes((prev) => prev.filter((s) => s.id !== id))
    })
  }

  function rechazar(id: string, nombre: string) {
    const motivoLimpio = motivo.trim()
    startTransition(async () => {
      const res = await rechazarSolicitudColor(id, motivoLimpio)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Solicitud "${nombre}" rechazada.`)
      setSolicitudes((prev) => prev.filter((s) => s.id !== id))
      setRechazandoId(null)
      setMotivo('')
    })
  }

  if (solicitudes.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 shadow-sm overflow-hidden">
      <div className="border-b border-amber-200 bg-amber-100/60 px-4 py-2.5">
        <p className="text-sm font-medium text-amber-900">
          {solicitudes.length}{' '}
          {solicitudes.length === 1
            ? 'solicitud de color pendiente'
            : 'solicitudes de color pendientes'}
        </p>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Operarios o ventas pidieron agregar estos colores al catálogo.
          Aprobalos para que aparezcan en los formularios.
        </p>
      </div>

      <ul className="divide-y divide-amber-200">
        {solicitudes.map((s) => (
          <li key={s.id} className="px-4 py-3">
            {rechazandoId === s.id ? (
              <div className="space-y-2">
                <p className="text-sm">
                  ¿Rechazar la solicitud para{' '}
                  <strong>{s.nombre_solicitado}</strong>?
                </p>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo del rechazo (opcional)"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRechazandoId(null)
                      setMotivo('')
                    }}
                    disabled={pending}
                    className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => rechazar(s.id, s.nombre_solicitado)}
                    disabled={pending}
                    className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {pending ? 'Rechazando…' : 'Rechazar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{s.nombre_solicitado}</p>
                  {s.motivo && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      “{s.motivo}”
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.solicitante ? `Pedido por ${s.solicitante} · ` : ''}
                    {new Date(s.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => aprobar(s.id, s.nombre_solicitado)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="size-3.5" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechazandoId(s.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/5 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
