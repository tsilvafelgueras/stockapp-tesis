'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearPedidoPendiente } from '../actions'

type Articulo = { id: string; nombre: string }

export default function NuevaDemandaForm({
  articulos,
}: {
  articulos: Articulo[]
}) {
  const router = useRouter()

  const [cliente, setCliente] = useState('')
  const [articuloId, setArticuloId] = useState('')
  const [color, setColor] = useState('')
  const [metros, setMetros] = useState('')
  const [kilos, setKilos] = useState('')
  const [notas, setNotas] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const res = await crearPedidoPendiente({
      cliente,
      articulo_id: articuloId,
      color,
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

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4 sm:p-6 shadow-sm space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Cliente *</label>
        <input
          type="text"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          required
          placeholder="Nombre del cliente"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Artículo</label>
          <select
            value={articuloId}
            onChange={(e) => setArticuloId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Seleccionar artículo...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Color</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Ej: Blanco"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Metros estimados</label>
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
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Kilos estimados</label>
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
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Urgencia, condiciones especiales, etc."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

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
          disabled={submitting || !cliente.trim()}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Guardando...' : 'Guardar demanda'}
        </button>
      </div>
    </form>
  )
}
