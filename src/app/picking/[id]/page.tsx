import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import { notFound } from 'next/navigation'
import { formatArticulos } from '@/lib/utils'
import PickingScanner, {
  type PickRollo,
  type AlternativaRollo,
} from './PickingScanner'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Lista', className: 'bg-success/15 text-success' },
  entregada: { text: 'Entregada', className: 'bg-zinc-100 text-zinc-700' },
  cancelada: {
    text: 'Cancelada',
    className: 'bg-destructive/15 text-destructive',
  },
}

export default async function PickingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, cliente, estado, created_at')
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  const { data: prRaw } = await supabase
    .from('pedido_rollos')
    .select(
      `
        id,
        pickeado_at,
        rollos (
          id,
          numero_pieza,
          ubicacion,
          kilos,
          articulo_id,
          color_id,
          articulos ( nombre ),
          colores ( nombre ),
          ingresos ( tintoreria_id )
        )
      `
    )
    .eq('pedido_id', id)

  type RolloRow = {
    id: string
    pickeado_at: string | null
    rollos: {
      id: string
      numero_pieza: string
      ubicacion: string | null
      kilos: number | null
      articulo_id: string | null
      color_id: string | null
      articulos: { nombre: string } | null
      colores: { nombre: string } | null
      ingresos: { tintoreria_id: string | null } | null
    } | null
  }
  const rows = (prRaw ?? []) as unknown as RolloRow[]

  const tintoreriaIds = Array.from(
    new Set(
      rows
        .map((r) => r.rollos?.ingresos?.tintoreria_id)
        .filter((v): v is string => Boolean(v))
    )
  )

  const patronesQuery = supabase
    .from('tintoreria_codigo_patrones')
    .select('pattern, capture_group, prioridad')
    .eq('activo', true)
    .order('prioridad', { ascending: true })

  const { data: patronesData } =
    tintoreriaIds.length > 0
      ? await patronesQuery.or(
          `tintoreria_id.in.(${tintoreriaIds.join(',')}),tintoreria_id.is.null`
        )
      : await patronesQuery.is('tintoreria_id', null)

  const patrones = patronesData ?? []

  let readerType: 'qr' | 'barcode' | null = null
  if (tintoreriaIds.length > 0) {
    const { data: tintsData } = await supabase
      .from('tintorerias')
      .select('reader_type')
      .in('id', tintoreriaIds)
    const tipos = new Set(
      (tintsData ?? []).map((t) => t.reader_type as 'qr' | 'barcode' | null)
    )
    if (tipos.size === 1) {
      const [unico] = Array.from(tipos)
      readerType = unico ?? null
    }
  }

  // Alternativas para reemplazo: rollos `en_stock` que NO estén reservados
  // a ningún pedido, filtrados por (articulo_id, color_id) de los rollos
  // pendientes en este pedido. Sirve para el modal de swap.
  const pendientesCombos = Array.from(
    new Set(
      rows
        .filter((r) => !r.pickeado_at && r.rollos?.articulo_id && r.rollos?.color_id)
        .map((r) => `${r.rollos!.articulo_id}|${r.rollos!.color_id}`)
    )
  )

  let alternativas: AlternativaRollo[] = []
  if (pendientesCombos.length > 0) {
    const articulosBuscar = Array.from(
      new Set(pendientesCombos.map((c) => c.split('|')[0]))
    )
    const coloresBuscar = Array.from(
      new Set(pendientesCombos.map((c) => c.split('|')[1]))
    )
    const { data: altRaw } = await supabase
      .from('rollos')
      .select(
        `
          id,
          numero_pieza,
          ubicacion,
          kilos,
          articulo_id,
          color_id,
          articulos ( nombre ),
          colores ( nombre ),
          pedido_rollos!left ( id )
        `
      )
      .eq('estado', 'en_stock')
      .in('articulo_id', articulosBuscar)
      .in('color_id', coloresBuscar)
      .limit(200)

    type AltRow = {
      id: string
      numero_pieza: string
      ubicacion: string | null
      kilos: number | null
      articulo_id: string
      color_id: string
      articulos: { nombre: string } | null
      colores: { nombre: string } | null
      pedido_rollos: { id: string }[] | null
    }
    alternativas = ((altRaw ?? []) as unknown as AltRow[])
      // Filtrar combinaciones (articulo, color) que aparecen en pendientesCombos.
      .filter((a) =>
        pendientesCombos.includes(`${a.articulo_id}|${a.color_id}`)
      )
      // Solo libres (sin asignación a ningún pedido).
      .filter((a) => !a.pedido_rollos || a.pedido_rollos.length === 0)
      .map((a) => ({
        id: a.id,
        numero_pieza: a.numero_pieza,
        ubicacion: a.ubicacion,
        kilos: a.kilos,
        articulo_id: a.articulo_id,
        color_id: a.color_id,
        articulo_nombre: a.articulos?.nombre ?? '—',
        color_nombre: a.colores?.nombre ?? '—',
      }))
  }

  const items: PickRollo[] = rows
    .filter((r) => r.rollos != null)
    .map((r) => ({
      pedido_rollo_id: r.id,
      pickeado_at: r.pickeado_at,
      rollo_id: r.rollos!.id,
      numero_pieza: r.rollos!.numero_pieza,
      ubicacion: r.rollos!.ubicacion,
      kilos: r.rollos!.kilos,
      articulo_id: r.rollos!.articulo_id,
      color_id: r.rollos!.color_id,
      articulo: r.rollos!.articulos?.nombre ?? null,
      color: r.rollos!.colores?.nombre ?? null,
    }))

  const estado = ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente

  const articulosLabel = formatArticulos(
    rows.map((r) => r.rollos?.articulos?.nombre)
  )
  const totalKilos = rows.reduce(
    (acc, r) => acc + Number(r.rollos?.kilos ?? 0),
    0
  )

  const pickeable =
    pedido.estado === 'pendiente' || pedido.estado === 'en_preparacion'

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href="/picking" label="Volver a picking" />
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">
            Picking · {pedido.cliente}
          </h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
          >
            {estado.text}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {articulosLabel} · {totalKilos.toFixed(2)} kg
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pedido {pedido.numero_pedido ?? '—'}
        </p>
      </div>

      {!pickeable ? (
        <div className="rounded-lg border bg-success/10 border-success/30 p-5 text-center space-y-2">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-success">
            Pedido {ESTADO_LABEL[pedido.estado]?.text.toLowerCase() ?? pedido.estado}
          </p>
          <p className="text-sm text-muted-foreground">
            Este pedido ya no está en etapa de picking.
          </p>
        </div>
      ) : (
        <PickingScanner
          pedidoId={id}
          items={items}
          alternativas={alternativas}
          patrones={patrones}
          readerType={readerType}
        />
      )}
    </div>
  )
}
