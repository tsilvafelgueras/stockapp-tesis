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
  falla_categoria: string | null
  falla_descripcion: string | null
  created_at: string
  auditado_at: string | null
  color: string | null
  articulos: { id: string; nombre: string } | null
  ingresos: {
    id: string
    fecha_despacho: string
    numero_remito: string | null
    numero_lote: string | null
    ot: string | null
    rem_tejeduria: string | null
    referencia: string | null
    tintorerias: { id: string; nombre: string } | null
  } | null
}

export type StockRole = 'operario' | 'ventas' | 'admin'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-amber-50 text-warning' },
  en_stock: { text: 'En stock', className: 'bg-green-50 text-success' },
  reservado: { text: 'Reservado', className: 'bg-blue-50 text-action' },
  entregado: { text: 'Entregado', className: 'bg-zinc-100 text-zinc-700' },
  baja: { text: 'Baja', className: 'bg-red-50 text-destructive' },
  segunda: { text: 'Segunda', className: 'bg-amber-100 text-amber-700' },
}

export default function StockList({
  rollos,
  role,
}: {
  rollos: StockRollo[]
  role: StockRole
}) {
  const [selected, setSelected] = useState<StockRollo | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<'view' | 'editar'>(
    'view'
  )
  const puedeEditarRollos = role === 'operario' || role === 'admin'

  function abrir(r: StockRollo, intent: 'view' | 'editar' = 'view') {
    setSelectedIntent(intent)
    setSelected(r)
  }

  if (rollos.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
        No hay rollos que coincidan con los filtros.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {rollos.map((r) => {
          const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.en_stock
          const dias = diasEnInventario(r.created_at)
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => abrir(r, 'view')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  abrir(r, 'view')
                }
              }}
              className="block w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FabricSwatch rollo={r} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">Pieza {r.numero_pieza}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.articulos?.nombre ?? '-'}
                      {r.color ? ` - ${r.color}` : ''}
                    </p>
                    {r.ingresos?.numero_lote && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.ingresos.numero_lote}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${estado.className}`}
                >
                  {estado.text}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {r.kilos != null && (
                  <span className="tabular-nums">
                    {Number(r.kilos).toFixed(2)} kg
                  </span>
                )}
                {r.ubicacion && <span>Ubic: {r.ubicacion}</span>}
                {r.ingresos?.tintorerias?.nombre && (
                  <span className="truncate">{r.ingresos.tintorerias.nombre}</span>
                )}
                <span className="tabular-nums">
                  Ingresó {formatFechaCorta(r.created_at)} · {dias}{' '}
                  {dias === 1 ? 'día' : 'días'} en inventario
                </span>
              </div>
              {(puedeEditarRollos || r.estado === 'segunda') && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {puedeEditarRollos && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrir(r, 'editar')
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50"
                    >
                      Editar
                    </button>
                  )}
                  {r.estado === 'segunda' && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      Ver detalle de falla
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b bg-muted">
              <tr className="text-left">
                <th className="w-12 px-3 py-3 font-medium"></th>
                <th className="px-3 py-3 font-medium">Pieza</th>
                <th className="px-3 py-3 font-medium">Lote</th>
                <th className="px-3 py-3 font-medium">Articulo</th>
                <th className="px-3 py-3 font-medium">Color</th>
                <th className="px-3 py-3 font-medium">Kilos</th>
                <th className="px-3 py-3 font-medium">Metros</th>
                <th className="px-3 py-3 font-medium">Ubicacion</th>
                <th className="px-3 py-3 font-medium">Tintoreria</th>
                <th className="px-3 py-3 font-medium">Ingreso</th>
                <th className="px-3 py-3 font-medium">Días</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rollos.map((r) => {
                const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.en_stock
                const dias = diasEnInventario(r.created_at)
                const esSegunda = r.estado === 'segunda'
                return (
                  <tr
                    key={r.id}
                    onClick={() => abrir(r, 'view')}
                    className="cursor-pointer border-b odd:bg-white even:bg-background/70 last:border-0 hover:bg-accent/55"
                  >
                    <td className="px-3 py-3">
                      <FabricSwatch rollo={r} />
                    </td>
                    <td className="px-3 py-3 font-medium">{r.numero_pieza}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {r.ingresos?.numero_lote ?? '-'}
                    </td>
                    <td className="px-3 py-3">{r.articulos?.nombre ?? '-'}</td>
                    <td className="px-3 py-3">{r.color ?? '-'}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.kilos != null ? Number(r.kilos).toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.metros != null ? Number(r.metros).toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-3">{r.ubicacion ?? '-'}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.ingresos?.tintorerias?.nombre ?? '-'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {formatFechaCorta(r.created_at)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {dias}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.className}`}
                      >
                        {estado.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-nowrap items-center justify-end gap-1.5">
                        {puedeEditarRollos && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrir(r, 'editar')
                            }}
                            className="whitespace-nowrap rounded-md border border-input bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                          >
                            Editar
                          </button>
                        )}
                        {esSegunda && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrir(r, 'view')
                            }}
                            className="whitespace-nowrap rounded-md border border-amber-400/40 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                          >
                            Detalle
                          </button>
                        )}
                      </div>
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
          key={`${selected.id}-${selectedIntent}`}
          rollo={selected}
          role={role}
          initialMode={selectedIntent}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function diasEnInventario(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  const ahora = Date.now()
  const diffMs = ahora - d.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function FabricSwatch({ rollo }: { rollo: StockRollo }) {
  if (rollo.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={rollo.foto_url}
        alt=""
        className="size-10 rounded-full border border-border bg-muted object-cover sm:size-9"
      />
    )
  }

  const label = (rollo.color ?? '-').slice(0, 2).toUpperCase()

  return (
    <div className="flex size-10 items-center justify-center rounded-full border border-border bg-[linear-gradient(135deg,#f8fafc_0%,#dbeafe_45%,#e2e8f0_100%)] text-[10px] font-semibold text-muted-foreground sm:size-9">
      {label}
    </div>
  )
}
