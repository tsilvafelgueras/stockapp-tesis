'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import CodeScanner, { type CodeScannerResult } from '@/components/CodeScanner'
import { ubicacionesToOptions, type UbicacionOption } from '@/lib/ubicaciones'
import { extraerCodigoCandidato, type PatronCodigo } from '@/lib/scanner'
import { agregarRolloAIngreso } from './actions'

type Articulo = { id: string; nombre: string }
type Color = { id: string; nombre: string }

type Props = {
  ingresoId: string
  articulos: Articulo[]
  colores: Color[]
  ubicaciones: UbicacionOption[]
  patrones: PatronCodigo[]
  defaultArticuloId: string | null
  defaultColorId: string | null
}

export default function AgregarRolloForm({
  ingresoId,
  articulos,
  colores,
  ubicaciones,
  patrones,
  defaultArticuloId,
  defaultColorId,
}: Props) {
  const router = useRouter()

  const [numeroPieza, setNumeroPieza] = useState('')
  const [articuloId, setArticuloId] = useState(defaultArticuloId ?? '')
  const [colorId, setColorId] = useState(defaultColorId ?? '')
  const [kilosStr, setKilosStr] = useState('')
  const [metrosStr, setMetrosStr] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarScanner, setMostrarScanner] = useState(false)

  const ubicacionOptions = ubicacionesToOptions(ubicaciones)
  const articuloOptions = articulos.map((a) => ({ value: a.id, label: a.nombre }))
  const colorOptions = colores.map((c) => ({ value: c.id, label: c.nombre }))

  function handleScan(result: CodeScannerResult) {
    let codigo: string
    if (result.manual) {
      codigo = result.texto.trim()
    } else {
      // Intentar extraer con los patrones de la tintorería; si no matchea, usar el raw.
      codigo = extraerCodigoCandidato(result.texto, patrones) ?? result.texto.trim()
    }
    setNumeroPieza(codigo)
    setMostrarScanner(false)
    toast.info(`Código capturado: ${codigo} — corregilo si hace falta.`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroPieza.trim()) {
      toast.error('El número de pieza es obligatorio.')
      return
    }

    setGuardando(true)
    try {
      const result = await agregarRolloAIngreso(ingresoId, {
        numero_pieza: numeroPieza.trim(),
        articulo_id: articuloId || null,
        color_id: colorId || null,
        kilos: kilosStr ? parseFloat(kilosStr) : null,
        metros: metrosStr ? parseFloat(metrosStr) : null,
        ubicacion: ubicacion || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(`Rollo ${numeroPieza.trim()} agregado correctamente.`)
      router.push(`/ingresos/${ingresoId}`)
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Número de pieza <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={numeroPieza}
              onChange={(e) => setNumeroPieza(e.target.value)}
              placeholder="Ej: 204021911"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setMostrarScanner((v) => !v)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
            >
              {mostrarScanner ? 'Cerrar' : 'Escanear'}
            </button>
          </div>
          {mostrarScanner && (
            <div className="mt-2">
              <CodeScanner
                onRead={handleScan}
                title="Escanear número de rollo"
                manualLabel="Ingresar código manualmente"
                manualPlaceholder="Ej: 204021911"
              />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Artículo</label>
          <SearchableCombobox
            value={articuloId}
            onChange={setArticuloId}
            options={articuloOptions}
            placeholder="Sin artículo"
            searchPlaceholder="Buscar artículo..."
            emptyLabel="No hay artículos"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Color</label>
          <SearchableCombobox
            value={colorId}
            onChange={setColorId}
            options={colorOptions}
            placeholder="Sin color"
            searchPlaceholder="Buscar color..."
            emptyLabel="No hay colores"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Kilos</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={kilosStr}
              onChange={(e) => setKilosStr(e.target.value)}
              placeholder="Ej: 12.50"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Metros</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={metrosStr}
              onChange={(e) => setMetrosStr(e.target.value)}
              placeholder="Ej: 45.00"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Ubicación</label>
          <SearchableCombobox
            value={ubicacion}
            onChange={setUbicacion}
            options={ubicacionOptions}
            placeholder="Sin ubicación"
            searchPlaceholder="Buscar ubicación..."
            emptyLabel="No hay ubicaciones"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => router.push(`/ingresos/${ingresoId}`)}
          disabled={guardando}
          className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Agregar rollo'}
        </button>
      </div>
    </form>
  )
}
