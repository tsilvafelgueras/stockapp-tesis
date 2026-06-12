'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { fechaEnRango } from '@/lib/fechas'

export type IngresoRow = {
  id: string
  numero_lote: string | null
  fecha_despacho: string | null
  numero_remito: string | null
  ot: string | null
  referencia: string | null
  rem_tejeduria: string | null
  estado: string
  tintoreria: string | null
  cantidadRollos: number
  sumaKilos: number
  articulosResumen: string
}

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  borrador: { text: 'Borrador', className: 'bg-zinc-100 text-zinc-700' },
  auditado: { text: 'Auditado', className: 'bg-warning/15 text-warning' },
  confirmado: { text: 'Confirmado', className: 'bg-success/15 text-success' },
}

export default function IngresosListClient({
  ingresos,
}: {
  ingresos: IngresoRow[]
}) {
  const [search, setSearch] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ingresos.filter((d) => {
      if (!fechaEnRango(d.fecha_despacho, desde, hasta)) return false
      if (!q) return true
      return [
        d.numero_lote,
        d.ot,
        d.numero_remito,
        d.referencia,
        d.rem_tejeduria,
      ].some((campo) => campo?.toLowerCase().includes(q))
    })
  }, [ingresos, search, desde, hasta])

  const hayFiltros = Boolean(search || desde || hasta)

  function limpiarFiltros() {
    setSearch('')
    setDesde('')
    setHasta('')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por partida, OT (tintorería), remito o referencia..."
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Desde
            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:pb-2.5"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Vista mobile: cards apilados */}
      <div className="sm:hidden space-y-3">
        {filtrados.length > 0 ? (
          filtrados.map((d) => {
            const estado = ESTADO_LABEL[d.estado] ?? ESTADO_LABEL.borrador
            return (
              <Link
                key={d.id}
                href={`/ingresos/${d.id}`}
                className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {d.numero_lote ? `${d.numero_lote} · ` : ''}
                      {d.fecha_despacho}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {d.tintoreria ?? '—'} · {d.articulosResumen || '—'}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                  >
                    {estado.text}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {d.cantidadRollos} {d.cantidadRollos === 1 ? 'rollo' : 'rollos'}
                  </span>
                  {d.sumaKilos > 0 && <span>{d.sumaKilos.toFixed(2)} kg</span>}
                  {d.numero_remito && <span>Rem: {d.numero_remito}</span>}
                  {d.ot && <span>OT: {d.ot}</span>}
                </div>
              </Link>
            )
          })
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            {hayFiltros
              ? 'No hay partidas que coincidan con los filtros.'
              : 'Todavía no cargaste ningún ingreso.'}
          </div>
        )}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Partida</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tintorería</th>
                <th className="px-4 py-3 font-medium">Artículos</th>
                <th className="px-4 py-3 font-medium">OT</th>
                <th className="px-4 py-3 font-medium">Remito</th>
                <th className="px-4 py-3 font-medium">Rollos</th>
                <th className="px-4 py-3 font-medium">Kilos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length > 0 ? (
                filtrados.map((d) => {
                  const estado = ESTADO_LABEL[d.estado] ?? ESTADO_LABEL.borrador
                  return (
                    <tr
                      key={d.id}
                      className="border-b last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/ingresos/${d.id}`}
                          className="font-medium hover:underline"
                        >
                          {d.numero_lote ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{d.fecha_despacho}</td>
                      <td className="px-4 py-3">{d.tintoreria ?? '—'}</td>
                      <td className="px-4 py-3">{d.articulosResumen || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.ot ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.numero_remito ?? '—'}
                      </td>
                      <td className="px-4 py-3">{d.cantidadRollos}</td>
                      <td className="px-4 py-3">
                        {d.sumaKilos > 0 ? `${d.sumaKilos.toFixed(2)} kg` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                        >
                          {estado.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {hayFiltros
                      ? 'No hay partidas que coincidan con los filtros.'
                      : 'Todavía no cargaste ningún ingreso.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
