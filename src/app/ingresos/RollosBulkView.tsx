'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import ExcelFilter, { type ExcelFilterOption } from '@/components/ExcelFilter'
import { UBICACIONES } from '@/lib/ubicaciones'
import { bulkEditRollos, type BulkEditChanges } from './bulkActions'

export type RolloBulk = {
  id: string
  numero_pieza: string
  kilos: number | null
  metros: number | null
  ubicacion: string | null
  estado: string
  articulo_id: string | null
  articulo_nombre: string | null
  color_id: string | null
  color_nombre: string | null
  ingreso_id: string
  ingreso_fecha: string | null
  ingreso_remito: string | null
  ingreso_ot: string | null
  ingreso_rem_tejeduria: string | null
  ingreso_referencia: string | null
  tintoreria_id: string | null
  tintoreria_nombre: string | null
}

type Catalogo = { id: string; nombre: string }

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_stock: 'En stock',
  reservado: 'Reservado',
  entregado: 'Entregado',
  baja: 'Baja',
  segunda: 'Segunda',
}

const ESTADOS_BULK: Array<{ value: 'en_stock' | 'segunda' | 'baja' | 'pendiente'; label: string }> = [
  { value: 'en_stock', label: 'En stock' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'segunda', label: 'Segunda' },
  { value: 'baja', label: 'Baja (solo admin)' },
]

type FilterKey =
  | 'tintoreria'
  | 'articulo'
  | 'color'
  | 'ot'
  | 'rem_tejeduria'
  | 'referencia'
  | 'estado'
  | 'ubicacion'

type FilterState = Record<FilterKey, string[]>

const EMPTY_FILTERS: FilterState = {
  tintoreria: [],
  articulo: [],
  color: [],
  ot: [],
  rem_tejeduria: [],
  referencia: [],
  estado: [],
  ubicacion: [],
}

export default function RollosBulkView({
  rollos,
  articulos,
  colores,
  role,
}: {
  rollos: RolloBulk[]
  articulos: Catalogo[]
  colores: Catalogo[]
  role: 'operario' | 'admin'
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()

  const [bulkMode, setBulkMode] = useState<
    null | 'ubicacion' | 'estado' | 'articulo' | 'color'
  >(null)
  const [bulkUbicacion, setBulkUbicacion] = useState('')
  const [bulkEstado, setBulkEstado] = useState<
    'en_stock' | 'segunda' | 'baja' | 'pendiente'
  >('en_stock')
  const [bulkArticulo, setBulkArticulo] = useState('')
  const [bulkColor, setBulkColor] = useState('')

  // Opciones para cada filtro derivadas de los rollos cargados.
  const filterOptions = useMemo(() => {
    const acc: Record<FilterKey, Map<string, { label: string; count: number }>> = {
      tintoreria: new Map(),
      articulo: new Map(),
      color: new Map(),
      ot: new Map(),
      rem_tejeduria: new Map(),
      referencia: new Map(),
      estado: new Map(),
      ubicacion: new Map(),
    }
    for (const r of rollos) {
      addOpt(acc.tintoreria, r.tintoreria_id ?? '', r.tintoreria_nombre ?? '')
      addOpt(acc.articulo, r.articulo_id ?? '', r.articulo_nombre ?? '')
      addOpt(acc.color, r.color_id ?? '', r.color_nombre ?? '')
      addOpt(acc.ot, r.ingreso_ot ?? '', r.ingreso_ot ?? '')
      addOpt(
        acc.rem_tejeduria,
        r.ingreso_rem_tejeduria ?? '',
        r.ingreso_rem_tejeduria ?? ''
      )
      addOpt(acc.referencia, r.ingreso_referencia ?? '', r.ingreso_referencia ?? '')
      addOpt(
        acc.estado,
        r.estado,
        ESTADO_LABEL[r.estado] ?? r.estado
      )
      addOpt(acc.ubicacion, r.ubicacion ?? '', r.ubicacion ?? '')
    }
    return Object.fromEntries(
      Object.entries(acc).map(([k, m]) => [
        k,
        [...m.entries()]
          .map(([value, { label, count }]) => ({ value, label, count }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es')),
      ])
    ) as Record<FilterKey, ExcelFilterOption[]>
  }, [rollos])

  // Aplica filtros + búsqueda libre al array de rollos.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rollos.filter((r) => {
      if (filters.tintoreria.length && !filters.tintoreria.includes(r.tintoreria_id ?? '')) {
        return false
      }
      if (filters.articulo.length && !filters.articulo.includes(r.articulo_id ?? '')) {
        return false
      }
      if (filters.color.length && !filters.color.includes(r.color_id ?? '')) {
        return false
      }
      if (filters.ot.length && !filters.ot.includes(r.ingreso_ot ?? '')) {
        return false
      }
      if (
        filters.rem_tejeduria.length &&
        !filters.rem_tejeduria.includes(r.ingreso_rem_tejeduria ?? '')
      ) {
        return false
      }
      if (
        filters.referencia.length &&
        !filters.referencia.includes(r.ingreso_referencia ?? '')
      ) {
        return false
      }
      if (filters.estado.length && !filters.estado.includes(r.estado)) {
        return false
      }
      if (filters.ubicacion.length && !filters.ubicacion.includes(r.ubicacion ?? '')) {
        return false
      }
      if (q && !r.numero_pieza.toLowerCase().includes(q)) return false
      return true
    })
  }, [rollos, filters, search])

  const visibles = filtered
  const allVisibleSelected =
    visibles.length > 0 && visibles.every((r) => selectedIds.has(r.id))
  const someSelected = selectedIds.size > 0

  const activeFilterCount = useMemo(() => {
    return (Object.keys(filters) as FilterKey[]).reduce(
      (acc, k) => acc + (filters[k].length > 0 ? 1 : 0),
      0
    )
  }, [filters])

  function setFilter(k: FilterKey, next: string[]) {
    setFilters((prev) => ({ ...prev, [k]: next }))
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setSearch('')
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of visibles) next.add(r.id)
      return next
    })
  }

  function deselectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of visibles) next.delete(r.id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function openBulk(mode: 'ubicacion' | 'estado' | 'articulo' | 'color') {
    setBulkMode(mode)
    setBulkUbicacion('')
    setBulkEstado('en_stock')
    setBulkArticulo('')
    setBulkColor('')
  }

  function applyBulk() {
    const ids = [...selectedIds]
    if (!ids.length) {
      toast.error('No seleccionaste ningún rollo.')
      return
    }
    let changes: BulkEditChanges
    let descripcion: string
    if (bulkMode === 'ubicacion') {
      if (!bulkUbicacion.trim()) {
        toast.error('La ubicación no puede estar vacía.')
        return
      }
      changes = { ubicacion: bulkUbicacion.trim() }
      descripcion = `ubicación → ${bulkUbicacion.trim()}`
    } else if (bulkMode === 'estado') {
      changes = { estado: bulkEstado }
      descripcion = `estado → ${ESTADO_LABEL[bulkEstado] ?? bulkEstado}`
    } else if (bulkMode === 'articulo') {
      if (!bulkArticulo) {
        toast.error('Elegí un artículo.')
        return
      }
      changes = { articulo_id: bulkArticulo }
      descripcion = `artículo`
    } else if (bulkMode === 'color') {
      if (!bulkColor) {
        toast.error('Elegí un color.')
        return
      }
      const colorMeta = colores.find((c) => c.id === bulkColor)
      changes = { color_id: bulkColor }
      descripcion = `color → ${colorMeta?.nombre ?? bulkColor}`
    } else {
      return
    }

    startTransition(async () => {
      const res = await bulkEditRollos(ids, changes)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `${res.afectados} ${res.afectados === 1 ? 'rollo actualizado' : 'rollos actualizados'} (${descripcion}).`
      )
      setBulkMode(null)
      clearSelection()
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº de pieza..."
          className="flex-1 min-w-[160px] rounded-md border px-3 py-2 text-sm"
        />
        {(activeFilterCount > 0 || search) && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Limpiar filtros ({activeFilterCount + (search ? 1 : 0)})
          </button>
        )}
      </div>

      {/* Filtros tipo Excel */}
      <div className="flex flex-wrap gap-2">
        <ExcelFilter
          label="Tintorería"
          options={filterOptions.tintoreria}
          selected={filters.tintoreria}
          onChange={(v) => setFilter('tintoreria', v)}
        />
        <ExcelFilter
          label="Artículo"
          options={filterOptions.articulo}
          selected={filters.articulo}
          onChange={(v) => setFilter('articulo', v)}
        />
        <ExcelFilter
          label="Color"
          options={filterOptions.color}
          selected={filters.color}
          onChange={(v) => setFilter('color', v)}
        />
        <ExcelFilter
          label="Lote (OT)"
          options={filterOptions.ot}
          selected={filters.ot}
          onChange={(v) => setFilter('ot', v)}
        />
        <ExcelFilter
          label="Rem. tejeduría"
          options={filterOptions.rem_tejeduria}
          selected={filters.rem_tejeduria}
          onChange={(v) => setFilter('rem_tejeduria', v)}
        />
        <ExcelFilter
          label="Referencia"
          options={filterOptions.referencia}
          selected={filters.referencia}
          onChange={(v) => setFilter('referencia', v)}
        />
        <ExcelFilter
          label="Estado"
          options={filterOptions.estado}
          selected={filters.estado}
          onChange={(v) => setFilter('estado', v)}
        />
        <ExcelFilter
          label="Ubicación"
          options={filterOptions.ubicacion}
          selected={filters.ubicacion}
          onChange={(v) => setFilter('ubicacion', v)}
        />
      </div>

      {/* Toolbar de selección + acciones bulk */}
      <div className="rounded-lg border bg-white p-3 shadow-sm flex flex-wrap items-center gap-2 sticky top-0 z-20">
        <div className="text-sm">
          <span className="font-medium">{selectedIds.size}</span>{' '}
          <span className="text-muted-foreground">
            de {visibles.length} visibles seleccionados
          </span>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={visibles.length === 0}
            className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            Seleccionar visibles ({visibles.length})
          </button>
          <button
            type="button"
            onClick={deselectAllVisible}
            disabled={!someSelected}
            className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Quitar visibles
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={!someSelected}
            className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Limpiar selección
          </button>
          <div className="w-px h-6 bg-zinc-200 self-center mx-1" />
          <button
            type="button"
            onClick={() => openBulk('ubicacion')}
            disabled={!someSelected}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Ubicación
          </button>
          <button
            type="button"
            onClick={() => openBulk('estado')}
            disabled={!someSelected}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Estado
          </button>
          <button
            type="button"
            onClick={() => openBulk('articulo')}
            disabled={!someSelected}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Artículo
          </button>
          <button
            type="button"
            onClick={() => openBulk('color')}
            disabled={!someSelected}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Color
          </button>
        </div>
      </div>

      {/* Modal de edición bulk */}
      {bulkMode && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !pending && setBulkMode(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">
                Editar {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'rollo' : 'rollos'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {bulkMode === 'ubicacion' && 'Asignar nueva ubicación a todos.'}
                {bulkMode === 'estado' && 'Cambiar estado de todos.'}
                {bulkMode === 'articulo' && 'Reasignar artículo de todos.'}
                {bulkMode === 'color' && 'Reasignar color de todos.'}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {bulkMode === 'ubicacion' && (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Nueva ubicación
                  </label>
                  <input
                    list="bulk-ubic-list"
                    type="text"
                    value={bulkUbicacion}
                    onChange={(e) => setBulkUbicacion(e.target.value)}
                    placeholder="Ej. A1"
                    autoFocus
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                  <datalist id="bulk-ubic-list">
                    {UBICACIONES.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              )}

              {bulkMode === 'estado' && (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Nuevo estado
                  </label>
                  <select
                    value={bulkEstado}
                    onChange={(e) =>
                      setBulkEstado(
                        e.target.value as
                          | 'en_stock'
                          | 'segunda'
                          | 'baja'
                          | 'pendiente'
                      )
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  >
                    {ESTADOS_BULK.filter(
                      (e) => e.value !== 'baja' || role === 'admin'
                    ).map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rollos en estado &quot;reservado&quot; o &quot;entregado&quot; no pueden cambiarse desde acá.
                  </p>
                </div>
              )}

              {bulkMode === 'articulo' && (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Nuevo artículo
                  </label>
                  <select
                    value={bulkArticulo}
                    onChange={(e) => setBulkArticulo(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {articulos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {bulkMode === 'color' && (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Nuevo color
                  </label>
                  <select
                    value={bulkColor}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {colores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="border-t px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkMode(null)}
                disabled={pending}
                className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyBulk}
                disabled={pending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? 'Aplicando…' : `Aplicar a ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de rollos */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-zinc-50 border-b sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          !allVisibleSelected &&
                          visibles.some((r) => selectedIds.has(r.id))
                      }
                    }}
                    onChange={() =>
                      allVisibleSelected ? deselectAllVisible() : selectAllVisible()
                    }
                  />
                </th>
                <th className="px-3 py-2 font-medium">Pieza</th>
                <th className="px-3 py-2 font-medium">Artículo</th>
                <th className="px-3 py-2 font-medium">Color</th>
                <th className="px-3 py-2 font-medium">OT</th>
                <th className="px-3 py-2 font-medium">Tintorería</th>
                <th className="px-3 py-2 font-medium">Kilos</th>
                <th className="px-3 py-2 font-medium">Ubicación</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay rollos que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                visibles.map((r) => {
                  const checked = selectedIds.has(r.id)
                  return (
                    <tr
                      key={r.id}
                      className={`border-b last:border-0 ${
                        checked ? 'bg-primary/5' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.numero_pieza}</td>
                      <td className="px-3 py-2">{r.articulo_nombre ?? '—'}</td>
                      <td className="px-3 py-2">{r.color_nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.ingreso_ot ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.tintoreria_nombre ?? '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.kilos != null ? Number(r.kilos).toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2">{r.ubicacion ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs rounded-full bg-zinc-100 px-2 py-0.5">
                          {ESTADO_LABEL[r.estado] ?? r.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.ingreso_fecha ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function addOpt(
  map: Map<string, { label: string; count: number }>,
  value: string,
  label: string
) {
  const prev = map.get(value)
  if (prev) {
    prev.count += 1
  } else {
    map.set(value, { label, count: 1 })
  }
}
