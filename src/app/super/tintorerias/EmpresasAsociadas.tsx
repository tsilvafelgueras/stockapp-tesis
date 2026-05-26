'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  asociarTintoreriaAEmpresa,
  desasociarTintoreriaDeEmpresa,
  reactivarTintoreriaDeEmpresa,
} from './actions'

type Empresa = { id: string; nombre: string }

type Link = {
  empresa_id: string
  contacto: string | null
  email: string | null
  telefono: string | null
  activo: boolean
  fecha_baja: string | null
  created_at: string
}

export default function EmpresasAsociadas({
  tintoreriaId,
  empresas,
  links,
}: {
  tintoreriaId: string
  empresas: Empresa[]
  links: Link[]
}) {
  const router = useRouter()
  const [empresaAAsociar, setEmpresaAAsociar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const empresaPorId = useMemo(() => {
    const m = new Map<string, Empresa>()
    for (const e of empresas) m.set(e.id, e)
    return m
  }, [empresas])

  const empresasYaAsociadas = useMemo(
    () => new Set(links.map((l) => l.empresa_id)),
    [links]
  )

  const empresasDisponibles = empresas.filter(
    (e) => !empresasYaAsociadas.has(e.id)
  )

  function asociar() {
    if (!empresaAAsociar) return
    setError(null)
    startTransition(async () => {
      const res = await asociarTintoreriaAEmpresa({
        tintoreriaId,
        empresaId: empresaAAsociar,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEmpresaAAsociar('')
      router.refresh()
    })
  }

  function desasociar(empresaId: string) {
    setError(null)
    startTransition(async () => {
      const res = await desasociarTintoreriaDeEmpresa({
        tintoreriaId,
        empresaId,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  function reactivar(empresaId: string) {
    setError(null)
    startTransition(async () => {
      const res = await reactivarTintoreriaDeEmpresa({
        tintoreriaId,
        empresaId,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="font-semibold">Empresas asociadas</h2>
        <p className="text-xs text-muted-foreground">
          Una misma tintorería puede trabajar con varias empresas. Los datos
          de contacto los carga cada empresa desde su sección de
          administración.
        </p>
      </div>

      {empresasDisponibles.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={empresaAAsociar}
            onChange={(e) => setEmpresaAAsociar(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Elegí empresa para asociar…</option>
            {empresasDisponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={asociar}
            disabled={!empresaAAsociar || pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? 'Asociando…' : 'Asociar'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {links.length === 0 ? (
        <p className="rounded-md border border-dashed bg-zinc-50 px-3 py-4 text-center text-xs text-muted-foreground">
          Esta tintorería no está asociada a ninguna empresa todavía.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => {
            const empresa = empresaPorId.get(l.empresa_id)
            return (
              <li
                key={l.empresa_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-zinc-50/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{empresa?.nombre ?? '—'}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {l.activo ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">
                        Activa
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5">
                        Dada de baja
                      </span>
                    )}
                    {l.contacto && <span>· {l.contacto}</span>}
                    {l.email && <span>· {l.email}</span>}
                    {l.telefono && <span>· {l.telefono}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!l.activo && (
                    <button
                      type="button"
                      onClick={() => reactivar(l.empresa_id)}
                      disabled={pending}
                      className="rounded-md border border-success/40 px-2.5 py-1 text-xs text-success hover:bg-success/5 disabled:opacity-50"
                    >
                      Reactivar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => desasociar(l.empresa_id)}
                    disabled={pending}
                    className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/5 disabled:opacity-50"
                  >
                    Desasociar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
