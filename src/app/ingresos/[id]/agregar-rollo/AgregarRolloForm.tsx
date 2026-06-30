'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { QrCode, Barcode } from 'lucide-react'
import SearchableCombobox from '@/components/SearchableCombobox'
import ScannerByReaderType from '@/components/ScannerByReaderType'
import type { CodeScannerResult } from '@/components/CodeScanner'
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
  const [scannerTipo, setScannerTipo] = useState<'qr' | 'barcode' | null>(null)
  const [agregados, setAgregados] = useState(0)
  const numeroRef = useRef<HTMLInputElement>(null)

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
    setScannerTipo(null)
    toast.info(`Código capturado: ${codigo} — corregilo si hace falta.`)
  }

  // `continuar=true` → guarda y deja el form listo para cargar otro rollo
  // (mantiene artículo/color/ubicación, limpia número/kilos/metros). Así se
  // pueden agregar varios rollos faltantes seguidos sin salir de la pantalla.
  async function guardar(continuar: boolean) {
    const pieza = numeroPieza.trim()
    if (!pieza) {
      toast.error('El número de pieza es obligatorio.')
      return
    }

    const kilos = kilosStr ? parseFloat(kilosStr.replace(',', '.')) : NaN
    if (!Number.isFinite(kilos) || kilos <= 0) {
      toast.error('Los kilos son obligatorios y deben ser mayores a cero.')
      return
    }

    setGuardando(true)
    try {
      const result = await agregarRolloAIngreso(ingresoId, {
        numero_pieza: pieza,
        articulo_id: articuloId || null,
        color_id: colorId || null,
        kilos,
        metros: metrosStr ? parseFloat(metrosStr.replace(',', '.')) : null,
        ubicacion: ubicacion || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(`Rollo ${pieza} agregado correctamente.`)
      setAgregados((n) => n + 1)

      if (continuar) {
        // Limpiar solo lo propio de cada rollo; conservar artículo/color/ubicación.
        setNumeroPieza('')
        setKilosStr('')
        setMetrosStr('')
        setScannerTipo(null)
        numeroRef.current?.focus()
        router.refresh()
      } else {
        router.push(`/ingresos/${ingresoId}`)
        router.refresh()
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        guardar(false)
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Número de pieza <span className="text-destructive">*</span>
          </label>
          <input
            ref={numeroRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={numeroPieza}
            onChange={(e) => setNumeroPieza(e.target.value)}
            placeholder="Ej: 204021911"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScannerTipo(scannerTipo === 'qr' ? null : 'qr')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                scannerTipo === 'qr'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-zinc-50'
              }`}
            >
              <QrCode className="h-4 w-4" />
              Código QR
            </button>
            <button
              type="button"
              onClick={() => setScannerTipo(scannerTipo === 'barcode' ? null : 'barcode')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                scannerTipo === 'barcode'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-zinc-50'
              }`}
            >
              <Barcode className="h-4 w-4" />
              Código de barras
            </button>
          </div>
          {scannerTipo && (
            <div className="mt-2">
              <ScannerByReaderType
                readerType={scannerTipo}
                onRead={handleScan}
                title={scannerTipo === 'qr' ? 'Escanear código QR' : 'Escanear código de barras'}
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
            <label className="text-sm font-medium">
              Kilos <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={kilosStr}
              onChange={(e) => setKilosStr(e.target.value)}
              placeholder="Ej: 12,50"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Metros</label>
            <input
              type="text"
              inputMode="decimal"
              value={metrosStr}
              onChange={(e) => setMetrosStr(e.target.value)}
              placeholder="Ej: 45,00"
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

      {agregados > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {agregados} {agregados === 1 ? 'rollo agregado' : 'rollos agregados'} en
          esta sesión.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push(`/ingresos/${ingresoId}`)}
            disabled={guardando}
            className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            {agregados > 0 ? 'Listo' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => guardar(true)}
            disabled={guardando}
            className="flex-1 rounded-md border border-primary bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar y agregar otro'}
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar y volver'}
          </button>
        </div>
      </div>
    </form>
  )
}
