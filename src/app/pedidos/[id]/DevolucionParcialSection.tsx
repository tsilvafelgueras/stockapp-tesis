'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { devolverRollosPedido } from '../actions'
import type { RolloPickeadoRow } from './RollosPickeadosTable'

export default function DevolucionParcialSection({
  pedidoId,
  rollos,
}: {
  pedidoId: string
  rollos: RolloPickeadoRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [motivo, setMotivo] = useState('')

  if (rollos.length === 0) return null

  const todosMarcados = seleccionados.size === rollos.length

  function toggleTodos() {
    if (todosMarcados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(rollos.map((r) => r.pedidoRolloId)))
    }
  }

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleDevolver() {
    if (seleccionados.size === 0) {
      toast.error('Seleccioná al menos un rollo para devolver.')
      return
    }
    startTransition(async () => {
      try {
        const res = await devolverRollosPedido(
          pedidoId,
          Array.from(seleccionados),
          motivo
        )
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const n = res.devueltos ?? seleccionados.size
        toast.success(
          `${n} ${n === 1 ? 'rollo devuelto' : 'rollos devueltos'} al stock como "Sin ubicar".`
        )
        setSeleccionados(new Set())
        setMotivo('')
        router.refresh()
      } catch (e) {
        console.error('[devolverRollosPedido] error', e)
        toast.error(
          e instanceof Error ? `Error: ${e.message}` : 'Error inesperado al devolver rollos.'
        )
      }
    })
  }

  return (
    <section className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm">Devolución parcial</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seleccioná los rollos que el cliente devolvió físicamente al depósito.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b text-left bg-zinc-50/50">
            <tr>
              <th className="px-4 py-2 font-medium w-10">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={toggleTodos}
                  disabled={pending}
                  className="rounded border-zinc-300 accent-primary"
                  aria-label="Seleccionar todos"
                />
              </th>
              <th className="px-4 py-2 font-medium">Pieza</th>
              <th className="px-4 py-2 font-medium">Artículo · Color</th>
              <th className="px-4 py-2 font-medium text-right">Kilos</th>
            </tr>
          </thead>
          <tbody>
            {rollos.map((r) => {
              const checked = seleccionados.has(r.pedidoRolloId)
              return (
                <tr
                  key={r.pedidoRolloId}
                  className={`border-b last:border-0 cursor-pointer ${
                    checked ? 'bg-primary/5' : 'hover:bg-zinc-50'
                  }`}
                  onClick={() => !pending && toggle(r.pedidoRolloId)}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.pedidoRolloId)}
                      disabled={pending}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-zinc-300 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-2 font-mono font-medium">
                    {r.numeroPieza}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[r.articulo, r.color].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-right text-muted-foreground">
                    {r.kilos != null
                      ? r.kilos.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' kg'
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t bg-zinc-50/50 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Motivo (opcional)
          </label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={pending}
            placeholder="Ej. Devolución por exceso, cambio de diseño..."
            className="w-full rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50 sm:max-w-md"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {seleccionados.size === 0
              ? 'Ningún rollo seleccionado'
              : `${seleccionados.size} ${seleccionados.size === 1 ? 'rollo seleccionado' : 'rollos seleccionados'}`}
          </p>
          <button
            type="button"
            onClick={handleDevolver}
            disabled={pending || seleccionados.size === 0}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {pending ? 'Devolviendo…' : 'Devolver seleccionados'}
          </button>
        </div>
      </div>
    </section>
  )
}
