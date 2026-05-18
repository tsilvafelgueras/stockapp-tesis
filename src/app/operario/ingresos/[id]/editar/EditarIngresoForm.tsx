'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { editarIngreso } from '@/app/operario/ingresos/nuevo/actions'

type Catalog = { id: string; nombre: string }

export default function EditarIngresoForm({
  ingreso,
  tintorerias,
  articulos,
}: {
  ingreso: {
    id: string
    tintoreria_id: string | null
    articulo_id: string | null
    fecha_despacho: string | null
    numero_remito: string | null
    color: string | null
    ot: string | null
    rem_tejeduria: string | null
    referencia: string | null
    total_rollos_declarado: number | null
    total_kilos_declarado: number | null
  }
  tintorerias: Catalog[]
  articulos: Catalog[]
}) {
  const router = useRouter()

  const [tintoreriaId, setTintoreriaId] = useState(ingreso.tintoreria_id ?? '')
  const [articuloId, setArticuloId] = useState(ingreso.articulo_id ?? '')
  const [fecha, setFecha] = useState(ingreso.fecha_despacho ?? '')
  const [numeroRemito, setNumeroRemito] = useState(ingreso.numero_remito ?? '')
  const [color, setColor] = useState(ingreso.color ?? '')
  const [ot, setOt] = useState(ingreso.ot ?? '')
  const [remTejeduria, setRemTejeduria] = useState(ingreso.rem_tejeduria ?? '')
  const [referencia, setReferencia] = useState(ingreso.referencia ?? '')
  const [totalRollos, setTotalRollos] = useState(
    ingreso.total_rollos_declarado != null ? String(ingreso.total_rollos_declarado) : ''
  )
  const [totalKilos, setTotalKilos] = useState(
    ingreso.total_kilos_declarado != null ? String(ingreso.total_kilos_declarado) : ''
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await editarIngreso({
      ingresoId: ingreso.id,
      tintoreria_id: tintoreriaId,
      articulo_id: articuloId,
      fecha,
      numero_remito: numeroRemito,
      color,
      ot,
      rem_tejeduria: remTejeduria,
      referencia,
      total_rollos_declarado: totalRollos,
      total_kilos_declarado: totalKilos,
    })

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
    // On success, server redirects automatically
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 sm:p-6 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tintorería *</label>
          <select
            value={tintoreriaId}
            onChange={(e) => setTintoreriaId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Seleccionar...</option>
            {tintorerias.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Artículo *</label>
          <select
            value={articuloId}
            onChange={(e) => setArticuloId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Seleccionar...</option>
            {articulos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Fecha *</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Número de remito</label>
          <input
            type="text"
            value={numeroRemito}
            onChange={(e) => setNumeroRemito(e.target.value)}
            placeholder="Ej: 49447"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
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
          <label className="text-sm font-medium">Total rollos declarado</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={totalRollos}
            onChange={(e) => setTotalRollos(e.target.value)}
            placeholder="Ej: 24"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Total kilos declarado</label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={totalKilos}
            onChange={(e) => setTotalKilos(e.target.value)}
            placeholder="Ej: 480.50"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">OT</label>
          <input
            type="text"
            value={ot}
            onChange={(e) => setOt(e.target.value)}
            placeholder="Orden de trabajo"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Remito tejeduría</label>
          <input
            type="text"
            value={remTejeduria}
            onChange={(e) => setRemTejeduria(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Referencia</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !tintoreriaId || !articuloId || !fecha}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
