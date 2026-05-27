'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createArticulo, updateArticulo, deleteArticulo } from './actions'
import { createColor, solicitarColor } from '@/app/admin/colores/actions'

type Catalog = { id: string; nombre: string }

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
  colores: Catalog[]
}

type Role = 'admin' | 'ventas' | 'operario' | 'super'

/**
 * Multi-selector de colores con "+ Nuevo color" role-aware.
 *
 * - Admin: el "+ Nuevo color" llama a `createColor` y aparece de
 *   inmediato como un chip seleccionado.
 * - Operario/Ventas: el "+ Nuevo color" llama a `solicitarColor` y
 *   queda pendiente de aprobación del admin. No se agrega al artículo
 *   hasta que el admin la apruebe.
 *
 * Para reutilizar la pivot `articulo_colores` con FK compuesta,
 * solo se asocian colores que ya existen en el catálogo. Por eso
 * los colores "pendientes de aprobación" no entran como seleccionados.
 */
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
    () => selectedIds.map((id) => colores.find((c) => c.id === id)).filter(Boolean) as Catalog[],
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
        // createColor no devuelve el id; la página se revalida y el
        // catálogo trae el nuevo color. Como atajo optimista, asumimos
        // que aparece en el siguiente render. La página revalida.
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
        toast.success(`"${limpio}" ya existe en el catálogo.`)
        onColorCreated(res.color as Catalog)
        agregar((res.color as Catalog).id)
      } else if ('alreadyPending' in res) {
        toast.info(`Ya hay una solicitud pendiente para "${limpio}".`)
      } else {
        toast.success(`Solicitud enviada al admin. Te avisamos cuando aprueben "${limpio}".`)
      }
      setNuevoNombre('')
      setCreating(false)
    })
  }

  return (
    <div className="space-y-1.5">
      {/* Chips seleccionados */}
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
                className="rounded-full hover:bg-action/20 p-0.5"
                aria-label={`Quitar color ${c.nombre}`}
                title="Quitar"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Agregar existente o crear nuevo */}
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
                ? 'Crear color nuevo…'
                : 'Solicitar color nuevo al admin…'
            }
            className={className}
          />
          <button
            type="button"
            onClick={crearOSolicitar}
            disabled={pending || !nuevoNombre.trim()}
            className="rounded-md bg-action px-2 py-1 text-xs font-medium text-action-foreground hover:bg-action/90 disabled:opacity-50"
          >
            {pending ? '…' : role === 'admin' || role === 'super' ? 'Crear' : 'Solicitar'}
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
                ? 'Agregar color…'
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
  const [stockMinimo, setStockMinimo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!coloresIds.length) {
      setError('Asociá al menos un color al artículo.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await createArticulo({
      nombre,
      descripcion,
      colores_ids: coloresIds,
      stock_minimo_kg: stockMinimo,
    })
    if (result.error) {
      setError(result.error)
    } else {
      setNombre('')
      setDescripcion('')
      setColoresIds([])
      setStockMinimo('')
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <h2 className="font-semibold">Nuevo artículo</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre *
          </label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Lycra ML40"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="descripcion" className="text-sm font-medium">
            Descripción
          </label>
          <input
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Colores *</label>
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
        </div>

        <div className="space-y-1">
          <label htmlFor="stock-minimo" className="text-sm font-medium">
            Stock mínimo (kg)
          </label>
          <input
            id="stock-minimo"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            placeholder="Sin límite"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !coloresIds.length}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : 'Agregar artículo'}
      </button>
    </form>
  )
}

export function EditArticuloRow({
  articulo,
  forzarEdicion = false,
  onEliminado,
  colores: coloresIniciales = [],
  role,
}: {
  articulo: Articulo
  forzarEdicion?: boolean
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
  const [stockMinimo, setStockMinimo] = useState(
    articulo.stock_minimo_kg != null ? String(articulo.stock_minimo_kg) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eliminandoPending, startEliminar] = useTransition()

  const editing = forzarEdicion

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!coloresIds.length) {
      setError('Asociá al menos un color al artículo.')
      toast.error('Asociá al menos un color al artículo.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await updateArticulo(articulo.id, {
      nombre,
      descripcion,
      colores_ids: coloresIds,
      stock_minimo_kg: stockMinimo,
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
      <tr className="border-b last:border-0 bg-destructive/5">
        <td colSpan={5} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              ¿Dar de baja{' '}
              <strong className="font-semibold">{articulo.nombre}</strong>? El
              artículo se ocultará de la lista pero los rollos y pedidos que lo
              usan siguen accesibles.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(false)}
                disabled={eliminandoPending}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={eliminandoPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {eliminandoPending ? 'Dando de baja…' : 'Sí, dar de baja'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  if (editing) {
    return (
      <tr className="border-b last:border-0 bg-zinc-50/50 align-top">
        <td className="px-4 py-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Nombre *"
            className="w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </td>
        <td className="px-4 py-3">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </td>
        <td className="px-4 py-3">
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
            className="w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            placeholder="Sin límite"
            className="w-28 rounded-md border border-input bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </td>
        <td className="px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center justify-end gap-1">
            {error && (
              <span className="mr-2 text-[11px] text-destructive">{error}</span>
            )}
            <button
              type="submit"
              disabled={loading || !coloresIds.length}
              className="rounded-md bg-action px-3 py-1.5 text-xs font-medium text-action-foreground hover:bg-action/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              className="flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              aria-label={`Dar de baja ${articulo.nombre}`}
              title="Dar de baja"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{articulo.nombre}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {articulo.descripcion || '—'}
      </td>
      <td className="px-4 py-3">
        {articulo.colores.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {articulo.colores.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
              >
                {c.nombre}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">
        {articulo.stock_minimo_kg != null
          ? `${articulo.stock_minimo_kg} kg`
          : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setConfirmandoEliminar(true)}
            className="flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
            aria-label={`Dar de baja ${articulo.nombre}`}
            title="Dar de baja"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default NuevoArticuloForm
