'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Pin, PinOff, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createArticulo, deleteArticulo, updateArticulo } from './actions'

type Catalog = {
  id: string
  nombre: string
  stock_minimo_kg?: number | null
  fijado?: boolean
}

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
  colores: Catalog[]
}

type Role = 'admin' | 'ventas' | 'operario' | 'super'

export function NuevoArticuloForm() {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createArticulo({ nombre, descripcion })
    if (result.error) {
      setError(result.error)
    } else {
      setNombre('')
      setDescripcion('')
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold">Nuevo artículo</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Lycra ML40"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Descripción">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="!mt-6 flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Agregar artículo'}
        </button>
      </div>
    </form>
  )
}

export function EditArticuloRow({
  articulo,
  expanded,
  onToggle,
  onEliminado,
  colores = [],
}: {
  articulo: Articulo
  expanded: boolean
  onToggle: () => void
  onEliminado?: (id: string) => void
  colores?: Catalog[]
  role: Role
}) {
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nombre, setNombre] = useState(articulo.nombre)
  const [descripcion, setDescripcion] = useState(articulo.descripcion ?? '')
  const [coloresIds, setColoresIds] = useState<string[]>(
    articulo.colores.map((c) => c.id)
  )
  const [stockMinimos, setStockMinimos] = useState<Record<string, string>>(
    Object.fromEntries(
      articulo.colores
        .filter((c) => c.stock_minimo_kg != null)
        .map((c) => [c.id, String(c.stock_minimo_kg)])
    )
  )
  const [fijados, setFijados] = useState<Set<string>>(
    () => new Set(articulo.colores.filter((c) => c.fijado).map((c) => c.id))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eliminandoPending, startEliminar] = useTransition()
  const [agregando, setAgregando] = useState(false)

  const disponibles = useMemo(
    () => colores.filter((c) => !coloresIds.includes(c.id)),
    [colores, coloresIds]
  )

  const nombreColor = useMemo(() => {
    const map = new Map(colores.map((c) => [c.id, c.nombre]))
    return (id: string) => map.get(id) ?? id
  }, [colores])

  // Orden de visualización: fijados primero (alfabético), luego el resto (alfabético).
  const coloresOrdenados = useMemo(() => {
    return [...coloresIds].sort((a, b) => {
      const fa = fijados.has(a)
      const fb = fijados.has(b)
      if (fa !== fb) return fa ? -1 : 1
      return nombreColor(a).localeCompare(nombreColor(b), 'es')
    })
  }, [coloresIds, fijados, nombreColor])

  function toggleFijado(id: string) {
    setFijados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetForm() {
    setNombre(articulo.nombre)
    setDescripcion(articulo.descripcion ?? '')
    setColoresIds(articulo.colores.map((c) => c.id))
    setStockMinimos(
      Object.fromEntries(
        articulo.colores
          .filter((c) => c.stock_minimo_kg != null)
          .map((c) => [c.id, String(c.stock_minimo_kg)])
      )
    )
    setFijados(new Set(articulo.colores.filter((c) => c.fijado).map((c) => c.id)))
    setAgregando(false)
    setError(null)
  }

  function agregarColor(id: string) {
    if (!id || coloresIds.includes(id)) return
    setColoresIds((prev) => [...prev, id])
    setAgregando(false)
  }

  function quitarColor(id: string) {
    setColoresIds((prev) => prev.filter((x) => x !== id))
    setStockMinimos((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setFijados((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!coloresIds.length) {
      setError('Asocia al menos un color al articulo.')
      toast.error('Asocia al menos un color al articulo.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await updateArticulo(articulo.id, {
      nombre,
      descripcion,
      colores_ids: coloresIds,
      stock_minimos_por_color: stockMinimos,
      fijados_color_ids: [...fijados],
    })
    if (result.error) {
      setError(result.error)
      toast.error(result.error)
    } else {
      toast.success(`"${nombre}" actualizado.`)
      setEditing(false)
    }
    setLoading(false)
  }

  function handleConfirmarEliminar() {
    startEliminar(async () => {
      const result = await deleteArticulo(articulo.id)
      if (result.error) {
        toast.error(result.error)
        setConfirmandoEliminar(false)
        return
      }
      toast.success(`"${articulo.nombre}" dado de baja.`)
      onEliminado?.(articulo.id)
    })
  }

  if (confirmandoEliminar) {
    return (
      <tr className="border-b bg-destructive/5">
        <td colSpan={5} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Dar de baja <strong>{articulo.nombre}</strong>. El artículo se
              ocultará de la lista pero los rollos y pedidos que lo usan siguen
              accesibles.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(false)}
                disabled={eliminandoPending}
                className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={eliminandoPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {eliminandoPending ? 'Dando de baja...' : 'Si, dar de baja'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b hover:bg-zinc-50"
      >
        <td className="w-10 px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100"
            aria-label={expanded ? 'Contraer articulo' : 'Expandir articulo'}
            title={expanded ? 'Contraer' : 'Expandir'}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 font-medium">{articulo.nombre}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {articulo.descripcion ?? '-'}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {articulo.colores.length}{' '}
          {articulo.colores.length === 1 ? 'color' : 'colores'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                resetForm()
                setEditing(true)
              }}
              className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmandoEliminar(true)
              }}
              className="inline-flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              aria-label={`Dar de baja ${articulo.nombre}`}
              title="Dar de baja"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </td>
      </tr>

      {expanded && !editing && (
        <tr className="border-b bg-zinc-50/60">
          <td colSpan={5} className="pb-3 pl-14 pr-4 pt-1">
            {coloresIds.length > 0 ? (
              <dl className="divide-y divide-zinc-200">
                {coloresOrdenados.map((colorId) => {
                  const color = colores.find((c) => c.id === colorId)
                  const stock = stockMinimos[colorId]
                  return (
                    <div
                      key={colorId}
                      className="flex items-center justify-between gap-4 py-2"
                    >
                      <dt className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {fijados.has(colorId) && (
                          <Pin
                            className="size-3.5 fill-warning text-warning"
                            aria-label="Fijado"
                          />
                        )}
                        {color?.nombre ?? colorId}
                      </dt>
                      <dd
                        className={
                          stock
                            ? 'text-sm font-medium text-foreground'
                            : 'text-sm text-muted-foreground'
                        }
                      >
                        {stock ? `${parseFloat(stock)} kg` : 'Sin límite'}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Sin colores asociados.</p>
            )}
          </td>
        </tr>
      )}

      {editing && (
        <tr className="border-b bg-zinc-50/60">
          <td />
          <td colSpan={4} className="px-4 py-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Nombre">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <Field label="Descripción">
                  <input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
              </div>

              <div className="overflow-hidden rounded-md border bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Color</th>
                      <th className="px-3 py-2 font-medium">Stock mínimo</th>
                      <th className="px-3 py-2 font-medium text-center">Fijar</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {coloresOrdenados.map((colorId) => {
                      const color = colores.find((c) => c.id === colorId)
                      const estaFijado = fijados.has(colorId)
                      return (
                        <tr key={colorId} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              {estaFijado && (
                                <Pin className="size-3.5 fill-warning text-warning" />
                              )}
                              {color?.nombre ?? 'Color'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={stockMinimos[colorId] ?? ''}
                                onChange={(e) =>
                                  setStockMinimos((prev) => ({
                                    ...prev,
                                    [colorId]: e.target.value,
                                  }))
                                }
                                placeholder="Sin limite"
                                className="w-28 rounded-md border border-input bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <span className="text-xs text-muted-foreground">kg</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleFijado(colorId)}
                              className={`inline-flex size-7 items-center justify-center rounded transition-colors ${
                                estaFijado
                                  ? 'text-warning hover:bg-warning/10'
                                  : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground'
                              }`}
                              title={estaFijado ? 'Desfijar color' : 'Fijar arriba'}
                              aria-pressed={estaFijado}
                            >
                              {estaFijado ? (
                                <Pin className="size-4 fill-warning" />
                              ) : (
                                <PinOff className="size-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => quitarColor(colorId)}
                              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-zinc-100 hover:text-destructive"
                              title="Quitar color"
                            >
                              <X className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {coloresIds.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-sm text-muted-foreground"
                        >
                          Sin colores asociados.
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="px-3 py-2">
                        {agregando ? (
                          <div className="flex items-center gap-2">
                            <select
                              autoFocus
                              value=""
                              onChange={(e) => agregarColor(e.target.value)}
                              className="rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="" disabled>
                                Elegir color...
                              </option>
                              {disponibles.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nombre}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setAgregando(false)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          disponibles.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setAgregando(true)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                            >
                              <Plus className="size-4" />
                              Agregar color
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {error && (
                  <span className="text-xs text-destructive">{error}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setEditing(false)
                  }}
                  disabled={loading}
                  className="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !coloresIds.length}
                  className="rounded-md bg-action px-4 py-2 text-sm font-medium text-action-foreground transition-colors hover:bg-action/90 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

export default NuevoArticuloForm
