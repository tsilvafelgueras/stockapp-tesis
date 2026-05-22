'use client'

import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { EditArticuloRow } from './ArticuloForm'

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
}

export default function ArticulosTabla({
  articulos: initial,
}: {
  articulos: Articulo[]
}) {
  const [articulos, setArticulos] = useState<Articulo[]>(initial)
  const [modoMasivo, setModoMasivo] = useState(false)

  function handleEliminar(id: string) {
    setArticulos((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">
          {articulos.length}{' '}
          {articulos.length === 1 ? 'artículo activo' : 'artículos activos'}
        </p>
        {articulos.length > 0 && (
          <button
            type="button"
            onClick={() => setModoMasivo((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              modoMasivo
                ? 'border-action bg-action text-action-foreground hover:bg-action/90'
                : 'border-action/40 text-action hover:bg-action/5'
            }`}
            title={modoMasivo ? 'Listo' : 'Editar todos los campos'}
          >
            {modoMasivo ? (
              <>
                <X className="size-3.5" />
                Listo
              </>
            ) : (
              <>
                <Pencil className="size-3.5" />
                Editar todo
              </>
            )}
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b text-muted-foreground">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Descripción</th>
            <th className="px-4 py-3 font-medium">Stock mínimo</th>
            <th className="px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {articulos.length > 0 ? (
            articulos.map((a) => (
              <EditArticuloRow
                key={a.id}
                articulo={a}
                forzarEdicion={modoMasivo}
                onEliminado={handleEliminar}
              />
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                Todavía no cargaste ningún artículo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
