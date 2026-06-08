'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'react-qr-code'
import { ArrowLeft, Printer, Share2, Copy, Check } from 'lucide-react'
import Link from 'next/link'

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
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Printer className="size-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Etiquetas */}
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 print:p-0 print:grid-cols-2 print:gap-0">
        {rollos.map((rollo) => (
          <div
            key={rollo.id}
            className="rounded-lg border-2 border-gray-800 p-4 space-y-3 print:rounded-none print:border print:border-gray-800 print:p-3 print:break-inside-avoid"
          >
            {/* Encabezado empresa */}
            <div className="text-center border-b border-gray-300 pb-2">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-600">
                NUDO · {rollo.tintoreria.toUpperCase()}
              </p>
            </div>

            {/* QR centrado */}
            <div className="flex justify-center py-2">
              <QRCode
                value={rollo.numero_pieza}
                size={120}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Número grande */}
            <div className="text-center">
              <p className="text-4xl font-black tracking-tight text-gray-900">
                {padNumero(rollo.numero_pieza)}
              </p>
            </div>

            {/* Datos */}
            <div className="space-y-1 text-sm border-t border-gray-200 pt-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Partida</span>
                <span className="font-semibold">{rollo.numero_lote || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tela</span>
                <span className="font-semibold">{rollo.articulo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Color</span>
                <span className="font-semibold">{rollo.color}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kilos</span>
                <span className="font-semibold">{rollo.kilos}</span>
              </div>
              {rollo.ubicacion && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ubic.</span>
                  <span className="font-semibold">{rollo.ubicacion}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha</span>
                <span className="font-semibold">{formatFecha(rollo.fecha_despacho)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
