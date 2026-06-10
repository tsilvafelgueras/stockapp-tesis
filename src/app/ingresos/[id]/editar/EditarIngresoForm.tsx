'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { editarIngreso } from '@/app/ingresos/nuevo/actions'
import { normalizarFechaISO } from '@/lib/fechas'

type Catalog = { id: string; nombre: string }

function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export default function EditarIngresoForm({
  ingreso,
  tintorerias,
  cantidadRollosReal,
  sumaKilosReal,
}: {
  ingreso: {
    id: string
    tintoreria_id: string | null
    fecha_despacho: string | null
    numero_remito: string | null
    ot: string | null
    rem_tejeduria: string | null
    referencia: string | null
    comentario: string | null
    total_rollos_declarado: number | null
    total_kilos_declarado: number | null
  }
  tintorerias: Catalog[]
  cantidadRollosReal: number
  sumaKilosReal: number
}) {
  const router = useRouter()

  const [tintoreriaId, setTintoreriaId] = useState(ingreso.tintoreria_id ?? '')
  const [fecha, setFecha] = useState(normalizarFechaISO(ingreso.fecha_despacho) ?? '')
  const [numeroRemito, setNumeroRemito] = useState(ingreso.numero_remito ?? '')
  const [ot, setOt] = useState(ingreso.ot ?? '')
  const [remTejeduria, setRemTejeduria] = useState(ingreso.rem_tejeduria ?? '')
  const [referencia, setReferencia] = useState(ingreso.referencia ?? '')
  const [comentario, setComentario] = useState(ingreso.comentario ?? '')
  const [totalRollos, setTotalRollos] = useState(
    ingreso.total_rollos_declarado != null ? String(ingreso.total_rollos_declarado) : ''
  )
  const [totalKilos, setTotalKilos] = useState(
    ingreso.total_kilos_declarado != null ? String(ingreso.total_kilos_declarado) : ''
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = useMemo(() => {
    const declaradoRollos = totalRollos.trim() === '' ? null : parseInt(totalRollos)
    const declaradoKilos = parseDecimalInput(totalKilos)

    const cantidadCoincide =
      declaradoRollos === null ||
      Number.isNaN(declaradoRollos) ||
      declaradoRollos === cantidadRollosReal

    const kilosCoinciden =
      declaradoKilos === null ||
      Number.isNaN(declaradoKilos) ||
      Math.abs(declaradoKilos - sumaKilosReal) < 0.01

    return { cantidadCoincide, kilosCoinciden, declaradoRollos, declaradoKilos }
  }, [totalRollos, totalKilos, cantidadRollosReal, sumaKilosReal])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await editarIngreso({
      ingresoId: ingreso.id,
      tintoreria_id: tintoreriaId,
      fecha,
      numero_remito: numeroRemito,
      ot,
      rem_tejeduria: remTejeduria,
      referencia,
      comentario,
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
            type="text"
            inputMode="decimal"
            value={totalKilos}
            onChange={(e) => setTotalKilos(e.target.value)}
            placeholder="Ej: 480.50 o 480,50"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">OT (partida tintorería)</label>
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

      <div className="space-y-1">
        <label className="text-sm font-medium">Comentario</label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          placeholder="Comentario de la partida. Vaciálo para borrarlo."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {(!validation.cantidadCoincide || !validation.kilosCoinciden) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-sm">
          {!validation.cantidadCoincide && (
            <p className="text-destructive">
              ⚠ Declaraste {validation.declaradoRollos} rollos pero el ingreso
              tiene {cantidadRollosReal} cargados. Ajustá el total o agregá los rollos faltantes desde el detalle.
            </p>
          )}
          {!validation.kilosCoinciden && (
            <p className="text-destructive">
              ⚠ Declaraste {validation.declaradoKilos} kg pero la suma real es {sumaKilosReal.toFixed(2)} kg. Ajustá el total declarado o corregí los kilos por rollo.
            </p>
          )}
        </div>
      )}

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
          disabled={
            submitting ||
            !tintoreriaId ||
            !fecha ||
            !validation.cantidadCoincide ||
            !validation.kilosCoinciden
          }
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
