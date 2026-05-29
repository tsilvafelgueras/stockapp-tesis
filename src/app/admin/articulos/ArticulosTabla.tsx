'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EditArticuloRow } from './ArticuloForm'

type Catalog = { id: string; nombre: string; stock_minimo_kg?: number | null }

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
  colores: Catalog[]
}

type Role = 'admin' | 'ventas' | 'operario' | 'super'

export default function ArticulosTabla({
  articulos: initial,
  colores,
  role,
}: {
  articulos: Articulo[]
  colores: Catalog[]
  role: Role
}) {
  const [articulos, setArticulos] = useState<Articulo[]>(initial)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const allExpanded =
    articulos.length > 0 && articulos.every((a) => expandedIds.has(a.id))

  function handleEliminar(id: string) {
    setArticulos((prev) => prev.filter((a) => a.id !== id))
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleOne(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(articulos.map((a) => a.id)))
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">
          {articulos.length}{' '}
          {articulos.length === 1 ? 'articulo activo' : 'articulos activos'}
        </p>
        {articulos.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-action/40 px-3 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action/5"
          >
            {allExpanded ? (
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
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-zinc-50 text-muted-foreground">
            <tr className="text-left">
              <th className="w-10 px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 font-medium">Articulo</th>
              <th className="px-4 py-3 font-medium">Descripcion</th>
              <th className="px-4 py-3 font-medium">Colores</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {articulos.length > 0 ? (
              articulos.map((a) => (
                <EditArticuloRow
                  key={a.id}
                  articulo={a}
                  expanded={expandedIds.has(a.id)}
                  onToggle={() => toggleOne(a.id)}
                  onEliminado={handleEliminar}
                  colores={colores}
                  role={role}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Todavia no cargaste ningun articulo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
