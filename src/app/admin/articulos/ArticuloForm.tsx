'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createColor, solicitarColor } from '@/app/admin/colores/actions'
import { createArticulo, deleteArticulo, updateArticulo } from './actions'

type Catalog = { id: string; nombre: string; stock_minimo_kg?: number | null }

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
  colores: Catalog[]
}

type Role = 'admin' | 'ventas' | 'operario' | 'super'

function ColorMultiPicker({
  selectedIds,
  onChange,
  colores,
  onColorCreated,
  role,
  className,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  colores: Catalog[]
  onColorCreated: (c: Catalog) => void
  role: Role
  className?: string
}) {
  const [creating, setCreating] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [pending, startTransition] = useTransition()

  const disponibles = useMemo(
    () => colores.filter((c) => !selectedIds.includes(c.id)),
    [colores, selectedIds]
  )
  const seleccionados = useMemo(
    () =>
      selectedIds
        .map((id) => colores.find((c) => c.id === id))
        .filter((c): c is Catalog => Boolean(c)),
    [colores, selectedIds]
  )

  function agregar(id: string) {
    if (!id || selectedIds.includes(id)) return
    onChange([...selectedIds, id])
  }

  function quitar(id: string) {
    onChange(selectedIds.filter((x) => x !== id))
  }

  function crearOSolicitar() {
    const limpio = nuevoNombre.trim()
    if (!limpio) return
    startTransition(async () => {
      if (role === 'admin' || role === 'super') {
        const res = await createColor({ nombre: limpio })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success(`Color "${limpio}" creado.`)
        setNuevoNombre('')
        setCreating(false)
        return
      }

      const res = await solicitarColor({ nombre: limpio })
      if ('error' in res) {
        toast.error(res.error ?? 'No se pudo enviar la solicitud.')
        return
      }
      if ('alreadyExists' in res && res.alreadyExists) {
        toast.success(`"${limpio}" ya existe en el catalogo.`)
        onColorCreated(res.color as Catalog)
        agregar((res.color as Catalog).id)
      } else if ('alreadyPending' in res) {
        toast.info(`Ya hay una solicitud pendiente para "${limpio}".`)
      } else {
        toast.success(`Solicitud enviada al admin para "${limpio}".`)
      }
      setNuevoNombre('')
      setCreating(false)
    })
  }

  return (
    <div className="space-y-1.5">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-action/10 px-2 py-0.5 text-xs font-medium text-action"
            >
              {c.nombre}
              <button
                type="button"
                onClick={() => quitar(c.id)}
                className="rounded-full p-0.5 hover:bg-action/20"
                aria-label={`Quitar color ${c.nombre}`}
                title="Quitar"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {creating ? (
        <div className="flex gap-1">
          <input
            autoFocus
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                crearOSolicitar()
              }
              if (e.key === 'Escape') {
                setCreating(false)
                setNuevoNombre('')
              }
            }}
            placeholder={
              role === 'admin' || role === 'super'
                ? 'Crear color nuevo...'
                : 'Solicitar color nuevo al admin...'
            }
            className={className}
          />
          <button
            type="button"
            onClick={crearOSolicitar}
            disabled={pending || !nuevoNombre.trim()}
            className="rounded-md bg-action px-2 py-1 text-xs font-medium text-action-foreground hover:bg-action/90 disabled:opacity-50"
          >
            {pending ? '...' : role === 'admin' || role === 'super' ? 'Crear' : 'Solicitar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setNuevoNombre('')
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100"
            aria-label="Cancelar"
            title="Cancelar"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <select
            value=""
            onChange={(e) => agregar(e.target.value)}
            className={className}
          >
            <option value="" disabled>
              {disponibles.length
                ? 'Agregar color...'
                : 'No quedan colores para agregar'}
            </option>
            {disponibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-zinc-100"
            aria-label={
              role === 'admin' || role === 'super'
                ? 'Crear color nuevo'
                : 'Solicitar color nuevo al admin'
            }
            title={
              role === 'admin' || role === 'super'
                ? 'Crear color nuevo'
                : 'Solicitar color nuevo al admin'
            }
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export function NuevoArticuloForm({
  colores: coloresIniciales = [],
  role,
}: {
  colores?: Catalog[]
  role: Role
}) {
  const [colores, setColores] = useState(coloresIniciales)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [coloresIds, setColoresIds] = useState<string[]>([])
  const [stockMinimos, setStockMinimos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!coloresIds.length) {
      setError('Asocia al menos un color al articulo.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await createArticulo({
      nombre,
      descripcion,
      colores_ids: coloresIds,
      stock_minimos_por_color: stockMinimos,
    })
    if (result.error) {
      setError(result.error)
    } else {
      setNombre('')
      setDescripcion('')
      setColoresIds([])
      setStockMinimos({})
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold">Nuevo articulo</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre *">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Lycra ML40"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Descripcion">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Colores *">
          <ColorMultiPicker
            selectedIds={coloresIds}
            onChange={setColoresIds}
            colores={colores}
            onColorCreated={(c) =>
              setColores((prev) =>
                prev.find((p) => p.id === c.id) ? prev : [...prev, c]
              )
            }
            role={role}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Stock minimo por color">
          <StockMinimosPorColor
            selectedIds={coloresIds}
            colores={colores}
            values={stockMinimos}
            onChange={setStockMinimos}
            inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !coloresIds.length}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Agregar articulo'}
      </button>
    </form>
  )
}

export function EditArticuloRow({
  articulo,
  expanded,
  onToggle,
  onEliminado,
  colores: coloresIniciales = [],
  role,
}: {
  articulo: Articulo
  expanded: boolean
  onToggle: () => void
  onEliminado?: (id: string) => void
  colores?: Catalog[]
  role: Role
}) {
  const [colores, setColores] = useState(coloresIniciales)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eliminandoPending, startEliminar] = useTransition()

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
    })
    if (result.error) {
      setError(result.error)
      toast.error(result.error)
    } else {
      toast.success(`"${nombre}" actualizado.`)
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
              Dar de baja <strong>{articulo.nombre}</strong>. El articulo se
              ocultara de la lista pero los rollos y pedidos que lo usan siguen
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
        <td className="px-4 py-3">
          <p className="font-medium">{articulo.nombre}</p>
          {articulo.descripcion && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {articulo.descripcion}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {articulo.colores.length}{' '}
          {articulo.colores.length === 1 ? 'color' : 'colores'}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          <StockMinimosResumen colores={articulo.colores} />
        </td>
        <td className="px-4 py-3 text-right">
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
        </td>
      </tr>

      {expanded && (
        <tr className="border-b bg-zinc-50/60">
          <td />
          <td colSpan={4} className="px-4 py-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
                <Field label="Nombre">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <Field label="Descripcion">
                  <input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <Field label="Colores">
                  <ColorMultiPicker
                    selectedIds={coloresIds}
                    onChange={setColoresIds}
                    colores={colores}
                    onColorCreated={(c) =>
                      setColores((prev) =>
                        prev.find((p) => p.id === c.id) ? prev : [...prev, c]
                      )
                    }
                    role={role}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
              </div>

              <div className="overflow-hidden rounded-md border bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/60 text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Color</th>
                      <th className="px-3 py-2 font-medium">Stock minimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coloresIds.length > 0 ? (
                      coloresIds.map((colorId) => {
                        const color = colores.find((c) => c.id === colorId)
                        return (
                          <tr key={colorId} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              {color?.nombre ?? 'Color'}
                            </td>
                            <td className="px-3 py-2">
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
                                className="w-32 rounded-md border border-input bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <span className="ml-2 text-xs text-muted-foreground">
                                kg
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-4 text-center text-sm text-muted-foreground"
                        >
                          Sin colores asociados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {error && (
                  <span className="text-xs text-destructive">{error}</span>
                )}
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

function StockMinimosPorColor({
  selectedIds,
  colores,
  values,
  onChange,
  inputClassName,
}: {
  selectedIds: string[]
  colores: Catalog[]
  values: Record<string, string>
  onChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
  inputClassName: string
}) {
  const seleccionados = selectedIds
    .map((id) => colores.find((c) => c.id === id))
    .filter((c): c is Catalog => Boolean(c))

  if (seleccionados.length === 0) {
    return <p className="text-xs text-muted-foreground">-</p>
  }

  return (
    <div className="space-y-2">
      {seleccionados.map((color) => (
        <label key={color.id} className="block space-y-1">
          <span className="block truncate text-xs text-muted-foreground">
            {color.nombre}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={values[color.id] ?? ''}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                [color.id]: e.target.value,
              }))
            }
            placeholder="Sin limite"
            className={inputClassName}
          />
        </label>
      ))}
    </div>
  )
}

function StockMinimosResumen({ colores }: { colores: Catalog[] }) {
  const conMinimo = colores.filter((c) => c.stock_minimo_kg != null)
  if (!conMinimo.length) return <span>-</span>

  return (
    <div className="space-y-1 text-xs">
      {conMinimo.slice(0, 2).map((color) => (
        <div key={color.id}>
          <span className="text-foreground">{color.nombre}</span>{' '}
          <span>{color.stock_minimo_kg} kg</span>
        </div>
      ))}
      {conMinimo.length > 2 && (
        <div className="text-muted-foreground">+{conMinimo.length - 2} mas</div>
      )}
    </div>
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
