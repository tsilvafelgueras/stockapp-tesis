'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Save, Printer, RotateCcw, Ruler } from 'lucide-react'
import {
  DEFAULT_ETIQUETA_CONFIG,
  ETIQUETA_LIMITES,
  type EtiquetaConfig,
} from '../etiqueta-config'
import { EtiquetaLabel, ROLLO_EJEMPLO } from '../EtiquetaLabel'
import { guardarEtiquetaConfig } from './actions'

// px por mm a 96 dpi (lo que usa el navegador para `mm` en CSS).
const MM_POR_PX = 96 / 25.4
// Lado del cuadro de calibración, en cm. Es la medida que DEBERÍA salir físicamente.
const CALIB_CM = 5

type FormState = {
  ancho_cm: string
  alto_cm: string
  qr_cm: string
  padding_cm: string
  factor: string
}

function configToForm(c: EtiquetaConfig): FormState {
  return {
    ancho_cm: (c.ancho_mm / 10).toString(),
    alto_cm: (c.alto_mm / 10).toString(),
    qr_cm: (c.qr_mm / 10).toString(),
    padding_cm: (c.padding_mm / 10).toString(),
    factor: c.factor_escala.toString(),
  }
}

function num(s: string, fallback = 0): number {
  const n = Number(s.replace(',', '.'))
  return isFinite(n) ? n : fallback
}

export default function AjustesForm({ configInicial }: { configInicial: EtiquetaConfig }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => configToForm(configInicial))

  // Estado del asistente de calibración.
  const [medidaReal, setMedidaReal] = useState('')
  const [imprimiendoCalib, setImprimiendoCalib] = useState(false)

  // Config numérica (en mm) derivada del formulario, para preview y guardado.
  const config: EtiquetaConfig = useMemo(
    () => ({
      ancho_mm: Math.round(num(form.ancho_cm, 10) * 10),
      alto_mm: Math.round(num(form.alto_cm, 10) * 10),
      qr_mm: Math.round(num(form.qr_cm, 3.4) * 10),
      padding_mm: Math.round(num(form.padding_cm, 0.2) * 10),
      factor_escala: num(form.factor, 1),
    }),
    [form]
  )

  // Escala de la vista previa para que entre en la columna (máx ~300px de ancho).
  const previewScale = useMemo(() => {
    const anchoPx = config.ancho_mm * MM_POR_PX
    const altoPx = config.alto_mm * MM_POR_PX
    return Math.min(1, 300 / anchoPx, 360 / altoPx)
  }, [config])

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleGuardar() {
    startTransition(async () => {
      const res = await guardarEtiquetaConfig(config)
      if (res.ok) {
        toast.success('Medidas guardadas.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleReset() {
    setForm(configToForm(DEFAULT_ETIQUETA_CONFIG))
    toast.info('Valores por defecto (10×10 cm). Acordate de guardar.')
  }

  // Imprime el cuadro de calibración pasando por el mismo factor que las
  // etiquetas, para poder medir el reescalado real del driver.
  function handleImprimirCalib() {
    setImprimiendoCalib(true)
  }

  useEffect(() => {
    if (!imprimiendoCalib) return
    const limpiar = () => setImprimiendoCalib(false)
    window.addEventListener('afterprint', limpiar)
    // Esperamos un frame para que el bloque de impresión esté montado.
    const t = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', limpiar)
    }
  }, [imprimiendoCalib])

  function handleCalcularFactor() {
    const medido = num(medidaReal, 0)
    if (medido <= 0) {
      toast.error('Ingresá cuánto midió el cuadro (en cm).')
      return
    }
    // factor_nuevo = factor_actual × (medida_esperada / medida_real)
    const nuevo = num(form.factor, 1) * (CALIB_CM / medido)
    const clamped = Math.min(
      ETIQUETA_LIMITES.factor_escala.max,
      Math.max(ETIQUETA_LIMITES.factor_escala.min, nuevo)
    )
    set('factor', clamped.toFixed(3))
    setMedidaReal('')
    toast.success(`Escala ajustada a ×${clamped.toFixed(3)}. Guardá y reimprimí.`)
  }

  // Lado del cuadro de calibración que se ENVÍA a imprimir (mm), ya con el factor.
  const calibLadoMm = Math.round(CALIB_CM * 10 * num(form.factor, 1))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Bloque de impresión del cuadro de calibración (solo visible al imprimir) */}
      {imprimiendoCalib && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  @page { size: ${calibLadoMm}mm ${calibLadoMm}mm; margin: 0; }
                  body { visibility: hidden; }
                  #calib-square, #calib-square * { visibility: visible; }
                  #calib-square {
                    position: fixed; top: 0; left: 0;
                    width: ${calibLadoMm}mm; height: ${calibLadoMm}mm;
                  }
                }
              `,
            }}
          />
          <div
            id="calib-square"
            className="hidden print:flex items-center justify-center border-2 border-black box-border"
            style={{ width: `${calibLadoMm}mm`, height: `${calibLadoMm}mm` }}
          >
            <span className="text-black text-xs font-bold">{CALIB_CM} cm</span>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link
          href="/rollos-sin-etiqueta/nuevo"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Medidas de etiqueta</h1>
          <p className="text-sm text-muted-foreground">
            Ajustá el tamaño de la etiqueta y calibrá la escala de tu impresora.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Columna izquierda: formulario */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Ancho (cm)" value={form.ancho_cm} onChange={(v) => set('ancho_cm', v)} />
            <Campo label="Alto (cm)" value={form.alto_cm} onChange={(v) => set('alto_cm', v)} />
            <Campo label="Tamaño del QR (cm)" value={form.qr_cm} onChange={(v) => set('qr_cm', v)} />
            <Campo label="Margen interno (cm)" value={form.padding_cm} onChange={(v) => set('padding_cm', v)} />
          </div>

          {/* Asistente de calibración */}
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Ruler className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Calibrar escala de impresión</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Si la etiqueta sale más chica (o más grande) de lo que ves en pantalla, es el
              driver de la impresora reescalando. Imprimí el cuadro de prueba, medilo con una
              regla e ingresá cuánto midió: la app calcula la escala correcta.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={handleImprimirCalib}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
              >
                <Printer className="size-4" />
                Imprimir cuadro ({CALIB_CM} cm)
              </button>
              <div className="flex items-end gap-2">
                <Campo
                  label="¿Cuánto midió? (cm)"
                  value={medidaReal}
                  onChange={setMedidaReal}
                  placeholder={String(CALIB_CM)}
                />
                <button
                  type="button"
                  onClick={handleCalcularFactor}
                  className="h-[38px] inline-flex items-center rounded-md px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Calcular
                </button>
              </div>
            </div>
            <div className="pt-1">
              <Campo
                label="Factor de escala"
                value={form.factor}
                onChange={(v) => set('factor', v)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                1 = sin ajuste. Mayor a 1 agranda; menor achica. Se aplica al imprimir.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGuardar}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Save className="size-4" />
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              <RotateCcw className="size-4" />
              Restablecer
            </button>
          </div>
        </div>

        {/* Columna derecha: vista previa */}
        <div>
          <p className="text-sm font-medium mb-2">
            Vista previa —{' '}
            <span className="text-muted-foreground">
              {(config.ancho_mm / 10).toLocaleString()} × {(config.alto_mm / 10).toLocaleString()} cm
            </span>
          </p>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 flex items-center justify-center min-h-[380px]">
            <div
              style={{
                width: `${config.ancho_mm * MM_POR_PX * previewScale}px`,
                height: `${config.alto_mm * MM_POR_PX * previewScale}px`,
              }}
            >
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <EtiquetaLabel
                  rollo={ROLLO_EJEMPLO}
                  config={config}
                  escala={1}
                  className="border-2 border-black"
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            El tamaño en pantalla es aproximado (depende del monitor). Lo que importa es la
            medida física: ajustala con la calibración.
          </p>
        </div>
      </div>
    </div>
  )
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  )
}
