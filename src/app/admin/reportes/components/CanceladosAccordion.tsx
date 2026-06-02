'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CanceladosResult } from '../queries/demanda'

const fmtKg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Jerarquía expandible de pedidos caídos: cada fila es un motivo (cantidad de
 * veces + kilos liberados totales), ordenada por el motivo más usado. Al
 * expandir muestra el detalle de cada pedido (cliente, kilos, fecha). Mismo
 * patrón que la tabla de artículos → colores.
 */
export default function CanceladosAccordion({
  data,
}: {
  data: CanceladosResult
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const todosAbiertos =
    data.porMotivo.length > 0 &&
    data.porMotivo.every((g) => expandidos.has(g.motivo))

  function toggle(motivo: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(motivo)) next.delete(motivo)
      else next.add(motivo)
      return next
    })
  }

  function toggleTodos() {
    setExpandidos(
      todosAbiertos ? new Set() : new Set(data.porMotivo.map((g) => g.motivo))
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.totalPedidos} pedido{data.totalPedidos === 1 ? '' : 's'} caído
          {data.totalPedidos === 1 ? '' : 's'} · {fmtKg(data.kilosLiberados)} kg
          liberados
        </p>
        <button
          type="button"
          onClick={toggleTodos}
          className="inline-flex items-center gap-1.5 rounded-md border border-action/40 px-3 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action/5"
        >
          {todosAbiertos ? (
            <>
              <ChevronDown className="size-3.5" />
              Contraer todo
            </>
          ) : (
            <>
              <ChevronRight className="size-3.5" />
              Expandir todo
            </>
          )}
        </button>
      </div>

      <div className="divide-y rounded-lg border">
        {data.porMotivo.map((g) => {
          const abierto = expandidos.has(g.motivo)
          return (
            <div key={g.motivo}>
              <button
                type="button"
                onClick={() => toggle(g.motivo)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                aria-expanded={abierto}
              >
                {abierto ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 font-medium">{g.label}</span>
                <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive tabular-nums">
                  {g.pedidos} {g.pedidos === 1 ? 'vez' : 'veces'}
                </span>
                <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">
                  {fmtKg(g.kilos)} kg
                </span>
              </button>

              {abierto && (
                <div className="overflow-x-auto bg-muted/20 px-4 pb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Pedido</th>
                        <th className="py-2 pr-4 font-medium">Cliente</th>
                        <th className="py-2 pr-4 font-medium text-right">
                          Kg liberados
                        </th>
                        <th className="py-2 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.detalle.map((p) => (
                        <tr key={p.numero_pedido} className="border-t border-border/60">
                          <td className="py-2 pr-4 font-medium">
                            #{p.numero_pedido}
                          </td>
                          <td className="py-2 pr-4">{p.cliente}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtKg(p.kilos)}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(p.fecha).toLocaleDateString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
