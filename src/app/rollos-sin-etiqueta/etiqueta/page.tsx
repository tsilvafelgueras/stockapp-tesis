'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'react-qr-code'
import { ArrowLeft, Printer, Share2, Copy, Check, Download } from 'lucide-react'
import Link from 'next/link'

// Tamaño físico del stock de etiquetas (Zebra ZD220).
// Para cambiar de stock, editar estas constantes.
const LABEL_WIDTH = '10cm' // tamaño físico de la página/etiqueta
const LABEL_HEIGHT = '10cm'
// Tamaño del contenido impreso. Es más chico que la etiqueta para que entre
// aunque el navegador deje sus márgenes "Default" (no hace falta poner
// "Márgenes: Ninguno"). Va centrado dentro de la etiqueta de 10×10.
const CONTENT_SIZE = '8cm'
const LABEL_PADDING = '0.15cm' // margen interno del contenido
const QR_SIZE = '3.4cm' // QR grande y escaneable

type RolloEtiqueta = {
  id: string
  numero_pieza: string
  kilos: number
  ubicacion: string | null
  articulo: string
  color: string
  numero_lote: string
  fecha_despacho: string
  tintoreria: string
}

function padNumero(n: string): string {
  const num = parseInt(n)
  if (isNaN(num)) return n
  return String(num).padStart(3, '0')
}

function formatFecha(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function EtiquetaPage() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

  const [rollos, setRollos] = useState<RolloEtiqueta[]>([])
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
      const [{ data, error: dbError }, { data: coloresRaw }] = await Promise.all([
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
              fecha_despacho,
              tintorerias(nombre)
            )
          `)
          .in('id', ids),
        supabase.from('colores').select('id, nombre'),
      ])

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

  return (
    <div>
      {/* Estilos de impresión para Zebra ZD220 — etiqueta física de ${LABEL_WIDTH}×${LABEL_HEIGHT}.
          Se montan solo en esta ruta, así no afectan la impresión del resto de la app. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: ${LABEL_WIDTH} ${LABEL_HEIGHT}; margin: 0; }
              html, body { margin: 0; padding: 0; }
              .etiquetas-print { display: block !important; }
              .etiqueta-print {
                width: ${CONTENT_SIZE};
                height: ${CONTENT_SIZE};
                box-sizing: border-box;
                padding: ${LABEL_PADDING};
                /* Centrado horizontal dentro del área imprimible. El tamaño
                   reducido evita que se corte si quedan los márgenes "Default". */
                margin: 0 auto;
                break-inside: avoid;
                break-after: page;
                border: none !important;
                border-radius: 0 !important;
                overflow: hidden;
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

        <div className="flex gap-2 ml-auto">
          {canShare ? (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              <Share2 className="size-4" />
              Compartir link
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
          >
            <Printer className="size-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="size-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Etiquetas */}
      <div className="etiquetas-print p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 print:p-0 print:block print:gap-0">
        {rollos.map((rollo) => (
          <div
            key={rollo.id}
            className="etiqueta-print mx-auto flex h-full flex-col rounded-lg border-2 border-black p-3 print:rounded-none print:border-0"
            style={{ width: CONTENT_SIZE, height: CONTENT_SIZE }}
          >
            {/* Encabezado empresa */}
            <div className="shrink-0 text-center border-b-2 border-black pb-1">
              <p className="text-xs font-bold tracking-widest uppercase text-black leading-tight">
                NUDO · {rollo.tintoreria.toUpperCase()}
              </p>
            </div>

            {/* Bloque principal: QR + número grande — llena el centro */}
            <div className="flex flex-1 items-center justify-center gap-3 py-1">
              <QRCode
                value={rollo.numero_pieza}
                size={256}
                bgColor="#ffffff"
                fgColor="#000000"
                style={{ width: QR_SIZE, height: QR_SIZE, flexShrink: 0 }}
              />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black leading-none">
                  Pieza
                </p>
                <p className="text-6xl font-black tracking-tight text-black leading-none">
                  {padNumero(rollo.numero_pieza)}
                </p>
              </div>
            </div>

            {/* Datos — fila inferior */}
            <div className="shrink-0 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] border-t-2 border-black pt-1 leading-tight">
              <div className="flex justify-between gap-1">
                <span className="font-medium text-black">Partida</span>
                <span className="font-bold text-black truncate">{rollo.numero_lote || '—'}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="font-medium text-black">Color</span>
                <span className="font-bold text-black truncate">{rollo.color}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="font-medium text-black">Tela</span>
                <span className="font-bold text-black truncate">{rollo.articulo}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="font-medium text-black">Kilos</span>
                <span className="font-bold text-black">{rollo.kilos}</span>
              </div>
              {rollo.ubicacion && (
                <div className="flex justify-between gap-1">
                  <span className="font-medium text-black">Ubic.</span>
                  <span className="font-bold text-black truncate">{rollo.ubicacion}</span>
                </div>
              )}
              <div className="flex justify-between gap-1">
                <span className="font-medium text-black">Fecha</span>
                <span className="font-bold text-black">{formatFecha(rollo.fecha_despacho)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
