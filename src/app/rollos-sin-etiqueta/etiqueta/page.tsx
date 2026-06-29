'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Printer, Share2, Copy, Check, Download, Settings2 } from 'lucide-react'
import Link from 'next/link'
import {
  DEFAULT_ETIQUETA_CONFIG,
  loadEtiquetaConfig,
  type EtiquetaConfig,
} from '../etiqueta-config'
import { EtiquetaLabel, type RolloEtiqueta } from '../EtiquetaLabel'

export default function EtiquetaPage() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

  const [rollos, setRollos] = useState<RolloEtiqueta[]>([])
  const [config, setConfig] = useState<EtiquetaConfig>(DEFAULT_ETIQUETA_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [canShare] = useState(
    () => typeof window !== 'undefined' && 'share' in navigator
  )

  useEffect(() => {
    async function load() {
      if (!ids.length) {
        setError('No se especificaron rollos.')
        setLoading(false)
        return
      }
      const supabase = createClient()

      // colores no se puede joinear directamente desde rollos en PostgREST
      // (la relación no resuelve y falla la query). Se consulta aparte y se mapea.
      const [{ data, error: dbError }, { data: coloresRaw }, configCargada] =
        await Promise.all([
          supabase
            .from('rollos')
            .select(`
              id,
              numero_pieza,
              kilos,
              ubicacion,
              color_id,
              articulos!inner(nombre),
              ingresos!inner(
                numero_lote,
                ot,
                fecha_despacho,
                tintorerias(nombre)
              )
            `)
            .in('id', ids),
          supabase.from('colores').select('id, nombre'),
          loadEtiquetaConfig(supabase),
        ])

      setConfig(configCargada)

      if (dbError) {
        setError('No se pudieron cargar los datos.')
        setLoading(false)
        return
      }

      const colorById = new Map(
        ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre])
      )

      type RolloRaw = {
        id: string
        numero_pieza: string
        kilos: number
        ubicacion: string | null
        color_id: string | null
        articulos: { nombre: string }
        ingresos: {
          numero_lote: string
          ot: string | null
          fecha_despacho: string
          tintorerias: { nombre: string } | null
        }
      }

      const mapped = (data ?? []).map((r: unknown) => {
        const row = r as RolloRaw
        return {
          id: row.id,
          numero_pieza: row.numero_pieza,
          kilos: row.kilos,
          ubicacion: row.ubicacion,
          articulo: row.articulos.nombre,
          color: row.color_id ? (colorById.get(row.color_id) ?? '—') : '—',
          numero_lote: row.ingresos.numero_lote,
          ot: row.ingresos.ot,
          fecha_despacho: row.ingresos.fecha_despacho,
          tintoreria: row.ingresos.tintorerias?.nombre ?? '—',
        }
      })

      // Mantener el orden original de ids
      mapped.sort(
        (a: RolloEtiqueta, b: RolloEtiqueta) =>
          ids.indexOf(a.id) - ids.indexOf(b.id)
      )
      setRollos(mapped)
      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePrint() {
    window.print()
  }

  function handleExportPdf() {
    const originalTitle = document.title
    const date = new Date().toISOString().slice(0, 10)
    document.title = `etiquetas-rollos-${date}`

    const restoreTitle = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle)
    window.print()
    setTimeout(restoreTitle, 1000)
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: 'Etiquetas de rollos',
        url: window.location.href,
      })
    } catch {
      // usuario canceló
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Cargando etiquetas...</div>
    )
  }

  if (error || !rollos.length) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-destructive">{error ?? 'No se encontraron rollos.'}</p>
        <Link
          href="/rollos-sin-etiqueta/nuevo"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </div>
    )
  }

  // En pantalla la etiqueta se ve a tamaño real (escala 1). Al imprimir se
  // agranda por el factor de calibración: la página y un transform: scale()
  // del mismo factor compensan el reescalado del driver de la impresora.
  const f = config.factor_escala
  const pageW = config.ancho_mm * f
  const pageH = config.alto_mm * f

  return (
    <div>
      {/* Estilos de impresión — la página se dimensiona según la config de la
          empresa (medida × factor de calibración). Se montan solo en esta ruta. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
              html, body { margin: 0; padding: 0; }
              .etiquetas-print { display: block !important; }
              .etiqueta-print {
                margin: 0 !important;
                transform: scale(${f});
                transform-origin: top left;
                break-inside: avoid;
                break-after: page;
                border: none !important;
                border-radius: 0 !important;
              }
              .etiqueta-print:last-child { break-after: auto; }
            }
          `,
        }}
      />

      {/* Barra de acciones — oculta al imprimir */}
      <div className="print:hidden p-4 sm:p-6 flex flex-wrap items-center gap-3 border-b border-border bg-background sticky top-0 z-10">
        <Link
          href="/rollos-sin-etiqueta/nuevo"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>

        <span className="text-sm text-muted-foreground">
          {rollos.length} etiqueta{rollos.length !== 1 ? 's' : ''}
        </span>

        <div className="flex flex-wrap gap-2 ml-auto">
          <Link
            href="/rollos-sin-etiqueta/ajustes"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
          >
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">Ajustar medidas</span>
          </Link>
          {canShare ? (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Compartir link</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar link'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Etiquetas */}
      <div className="etiquetas-print p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 print:p-0 print:block print:gap-0">
        {rollos.map((rollo) => (
          <EtiquetaLabel
            key={rollo.id}
            rollo={rollo}
            config={config}
            className="mx-auto rounded-lg border-2 border-black print:rounded-none print:border-0"
          />
        ))}
      </div>
    </div>
  )
}
