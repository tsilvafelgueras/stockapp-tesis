'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createArticulo, updateArticulo, deleteArticulo } from './actions'

type Articulo = {
  id: string
  nombre: string
  descripcion: string | null
  color: string | null
  stock_minimo_kg: number | null
}

type Catalog = { id: string; nombre: string }

function ColorSelect({
  value,
  onChange,
  colores,
  className,
}: {
  value: string
  onChange: (v: string) => void
  colores: Catalog[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Sin color</option>
      {colores.map((c) => (
        <option key={c.id} value={c.nombre}>
          {c.nombre}
        </option>
      ))}
      {value && !colores.find((c) => c.nombre === value) && (
        <option value={value}>{value} (legacy)</option>
      )}
    </select>
  )
}

export function NuevoArticuloForm({
  colores = [],
}: {
  colores?: Catalog[]
}) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState('')
  const [stockMinimo, setStockMinimo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createArticulo({
      nombre,
      descripcion,
      color,
      stock_minimo_kg: stockMinimo,
    })
    if (result.error) {
      setError(result.error)
    } else {
      setNombre('')
      setDescripcion('')
      setColor('')
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
          <label htmlFor="color" className="text-sm font-medium">
            Color
          </label>
          <ColorSelect
            value={color}
            onChange={setColor}
            colores={colores}
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
        disabled={loading}
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
  colores = [],
}: {
  articulo: Articulo
  forzarEdicion?: boolean
  onEliminado?: (id: string) => void
  colores?: Catalog[]
}) {
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [nombre, setNombre] = useState(articulo.nombre)
  const [descripcion, setDescripcion] = useState(articulo.descripcion ?? '')
  const [color, setColor] = useState(articulo.color ?? '')
  const [stockMinimo, setStockMinimo] = useState(
    articulo.stock_minimo_kg != null ? String(articulo.stock_minimo_kg) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eliminandoPending, startEliminar] = useTransition()

  // El edit individual se elimino: solo se entra en modo edicion via el
  // toggle "Editar todo" global en ArticulosTabla.
  const editing = forzarEdicion

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await updateArticulo(articulo.id, {
      nombre,
      descripcion,
      color,
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

  // Modo confirmación de baja: ocupa toda la fila
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

  // Modo edición masiva
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
          <ColorSelect
            value={color}
            onChange={setColor}
            colores={colores}
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
              disabled={loading}
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

  // Modo vista
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{articulo.nombre}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {articulo.descripcion || '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {articulo.color || '—'}
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
