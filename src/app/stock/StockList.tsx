'use client'

import { useState } from 'react'
import RolloDetailDialog from './RolloDetailDialog'

export type StockRollo = {
  id: string
  numero_pieza: string
  ubicacion: string | null
  pantone: string | null
  foto_url: string | null
  kilos: number | null
  metros: number | null
  kilos_propios: number | null
  metros_propios: number | null
  ancho_propio: number | null
  gramaje_propio: number | null
  gramaje_planilla: number | null
  estado: string
  created_at: string
  articulos: { id: string; nombre: string } | null
  ingresos: {
    id: string
    fecha_despacho: string
    numero_remito: string | null
    color: string | null
    ot: string | null
    rem_tejeduria: string | null
    referencia: string | null
    tintorerias: { id: string; nombre: string } | null
  } | null
}

export type StockRole = 'operario' | 'ventas' | 'admin'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_stock: { text: 'En stock', className: 'bg-success/15 text-success' },
  reservado: { text: 'Reservado', className: 'bg-primary/15 text-primary' },
  entregado: { text: 'Entregado', className: 'bg-zinc-100 text-zinc-700' },
  baja: { text: 'Baja', className: 'bg-destructive/15 text-destructive' },
}

export default function StockList({
  rollos,
  role,
}: {
  rollos: StockRollo[]
  role: StockRole
}) {
  const [selected, setSelected] = useState<StockRollo | null>(null)

  if (rollos.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
        No hay rollos que coincidan con los filtros.
      </div>
    )
  }

  return (
    <>
      {/* Mobile: cards apilados */}
      <div className="sm:hidden space-y-3">
        {rollos.map((r) => {
          const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.en_stock
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r)}
              className="block w-full text-left rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    Pieza {r.numero_pieza}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {r.articulos?.nombre ?? '—'}
                    {r.ingresos?.color ? ` · ${r.ingresos.color}` : ''}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                >
                  {estado.text}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {r.kilos != null && (
                  <span className="tabular-nums">
                    {Number(r.kilos).toFixed(2)} kg
                  </span>
                )}
                {r.ubicacion && <span>Ubic: {r.ubicacion}</span>}
                {r.ingresos?.tintorerias?.nombre && (
                  <span className="truncate">
                    {r.ingresos.tintorerias.nombre}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-3 py-3 font-medium w-12"></th>
                <th className="px-3 py-3 font-medium">Pieza</th>
                <th className="px-3 py-3 font-medium">Artículo</th>
                <th className="px-3 py-3 font-medium">Color</th>
                <th className="px-3 py-3 font-medium">Kilos</th>
                <th className="px-3 py-3 font-medium">Metros</th>
                <th className="px-3 py-3 font-medium">Ubicación</th>
                <th className="px-3 py-3 font-medium">Tintorería</th>
                <th className="px-3 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rollos.map((r) => {
                const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.en_stock
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="border-b last:border-0 hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-3 py-3">
                      {r.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.foto_url}
                          alt=""
                          className="h-9 w-9 rounded object-cover bg-zinc-100"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-zinc-100 flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          {(r.ingresos?.color ?? '—').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium">{r.numero_pieza}</td>
                    <td className="px-3 py-3">
                      {r.articulos?.nombre ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      {r.ingresos?.color ?? '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.kilos != null ? Number(r.kilos).toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.metros != null ? Number(r.metros).toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-3">{r.ubicacion ?? '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.ingresos?.tintorerias?.nombre ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                      >
                        {estado.text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <RolloDetailDialog
          key={selected.id}
          rollo={selected}
          role={role}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
