'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SearchableCombobox from '@/components/SearchableCombobox'
import { crearPedidoPendiente } from '../actions'

type Catalogo = { id: string; nombre: string }
type ArticuloColor = { articulo_id: string; color_id: string }

export default function NuevaDemandaForm({
  clientes,
  articulos,
  colores,
  articuloColores,
}: {
  clientes: Catalogo[]
  articulos: Catalogo[]
  colores: Catalogo[]
  articuloColores: ArticuloColor[]
}) {
  const router = useRouter()

  const [clienteId, setClienteId] = useState('')
  const [articuloId, setArticuloId] = useState('')
  const [colorId, setColorId] = useState('')
  const [tipoDemanda, setTipoDemanda] = useState('demanda_sin_stock')
  const [prioridad, setPrioridad] = useState('flexible')
  const [fechaRequerida, setFechaRequerida] = useState('')
  const [metros, setMetros] = useState('')
  const [kilos, setKilos] = useState('')
  const [notas, setNotas] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clienteOptions = clientes.map((c) => ({
    value: c.id,
    label: c.nombre,
  }))
  const articuloOptions = articulos.map((a) => ({
    value: a.id,
    label: a.nombre,
  }))

  const colorOptions = useMemo(() => {
    if (!articuloId) {
      return colores.map((c) => ({ value: c.id, label: c.nombre }))
    }
    const allowed = new Set(
      articuloColores
        .filter((ac) => ac.articulo_id === articuloId)
        .map((ac) => ac.color_id)
    )
    const base = allowed.size > 0 ? colores.filter((c) => allowed.has(c.id)) : colores
    return base.map((c) => ({ value: c.id, label: c.nombre }))
  }, [articuloColores, articuloId, colores])

  function handleArticuloChange(value: string) {
    setArticuloId(value)
    const allowed = new Set(
      articuloColores
        .filter((ac) => ac.articulo_id === value)
        .map((ac) => ac.color_id)
    )
    if (value && allowed.size > 0 && colorId && !allowed.has(colorId)) {
      setColorId('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const res = await crearPedidoPendiente({
      cliente_id: clienteId,
      articulo_id: articuloId,
      color_id: colorId,
      tipo_demanda: tipoDemanda,
      prioridad,
      fecha_requerida: fechaRequerida,
      metros_estimados: metros,
      kilos_estimados: kilos,
      notas,
    })

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }

    router.push('/pedidos-pendientes')
  }

  const faltaRequerido =
    !clienteId ||
    !articuloId ||
    !colorId ||
    (prioridad === 'programada' && !fechaRequerida)

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 sm:p-6 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Cliente *">
          <SearchableCombobox
            value={clienteId}
            onChange={setClienteId}
            options={clienteOptions}
            placeholder="Seleccionar cliente..."
            emptyLabel="No hay clientes activos"
            allowClear={false}
          />
        </Field>

        <Field label="Tipo de demanda">
          <select
            value={tipoDemanda}
            onChange={(e) => setTipoDemanda(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="demanda_sin_stock">Demanda sin stock</option>
            <option value="pedido_a_producir">Pedido a producir</option>
          </select>
        </Field>

        <Field label="Articulo *">
          <SearchableCombobox
            value={articuloId}
            onChange={handleArticuloChange}
            options={articuloOptions}
            placeholder="Seleccionar articulo..."
            emptyLabel="No hay articulos activos"
            allowClear={false}
          />
        </Field>

        <Field label="Color *">
          <SearchableCombobox
            value={colorId}
            onChange={setColorId}
            options={colorOptions}
            placeholder="Seleccionar color..."
            emptyLabel="No hay colores para ese articulo"
            disabled={!articuloId}
            allowClear={false}
          />
        </Field>

        <Field label="Prioridad">
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="critica">Critica</option>
            <option value="alta">Alta</option>
            <option value="programada">Programada</option>
            <option value="flexible">Flexible</option>
          </select>
        </Field>

        <Field
          label={prioridad === 'programada' ? 'Fecha requerida *' : 'Fecha requerida'}
        >
          <input
            type="date"
            value={fechaRequerida}
            onChange={(e) => setFechaRequerida(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Metros estimados">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={metros}
            onChange={(e) => setMetros(e.target.value)}
            placeholder="Ej: 500"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Kilos estimados">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={kilos}
            onChange={(e) => setKilos(e.target.value)}
            placeholder="Ej: 120"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </div>

      <Field label="Notas">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Detalle comercial, comentario del cliente, etc."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/pedidos-pendientes')}
          className="rounded-md border bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || faltaRequerido}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Guardando...' : 'Guardar demanda'}
        </button>
      </div>
    </form>
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
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
