import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import { notFound } from 'next/navigation'
import PickingScanner, {
  type PickPartida,
  type PickRollo,
} from './PickingScanner'
import ConfirmarEgresoCard from './ConfirmarEgresoCard'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparacion',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Pedido listo', className: 'bg-success/15 text-success' },
  confirmada_egreso: {
    text: 'Egreso confirmado',
    className: 'bg-primary/15 text-primary',
  },
  cancelada: {
    text: 'Cancelada',
    className: 'bg-destructive/15 text-destructive',
  },
}

type PedidoPartidaRaw = {
  id: string
  ingreso_id: string
  articulo_id: string
  color_id: string
  rollos_solicitados: number
  articulos: { nombre: string } | null
  ingresos: {
    numero_lote: string | null
    tintoreria_id: string | null
    tintorerias: { nombre: string } | null
  } | null
  pedido_rollos: { id: string; liberado_at: string | null }[] | null
}

type PedidoRolloRaw = {
  id: string
  pedido_partida_id: string | null
  pickeado_at: string | null
  rollos: {
    id: string
    numero_pieza: string
    ubicacion: string | null
    kilos: number | null
    articulo_id: string | null
    color_id: string | null
    articulos: { nombre: string } | null
  } | null
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
    .select('id, numero_pedido, cliente, estado, created_at, numero_remito_salida')
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  const [{ data: partidasRaw }, { data: prRaw }, { data: coloresRaw }] =
    await Promise.all([
      supabase
        .from('pedido_partidas')
        .select(
          `
            id,
            ingreso_id,
            articulo_id,
            color_id,
            rollos_solicitados,
            articulos ( nombre ),
            ingresos (
              numero_lote,
              tintoreria_id,
              tintorerias ( nombre )
            ),
            pedido_rollos ( id, liberado_at )
          `
        )
        .eq('pedido_id', id),
      supabase
        .from('pedido_rollos')
        .select(
          `
            id,
            pedido_partida_id,
            pickeado_at,
            rollos (
              id,
              numero_pieza,
              ubicacion,
              kilos,
              articulo_id,
              color_id,
              articulos ( nombre )
            )
          `
        )
        .eq('pedido_id', id)
        .is('liberado_at', null),
      supabase.from('colores').select('id, nombre'),
    ])

  const colorById = new Map(
    ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ])
  )

  const partidas: PickPartida[] = ((partidasRaw ?? []) as unknown as PedidoPartidaRaw[])
    .map((p) => ({
      id: p.id,
      numeroLote: p.ingresos?.numero_lote ?? null,
      articuloId: p.articulo_id,
      colorId: p.color_id,
      articulo: p.articulos?.nombre ?? 'Articulo',
      color: colorById.get(p.color_id) ?? 'Color',
      tintoreria: p.ingresos?.tintorerias?.nombre ?? null,
      rollosSolicitados: Number(p.rollos_solicitados ?? 0),
      rollosAsignados:
        p.pedido_rollos?.filter((pr) => pr.liberado_at == null).length ?? 0,
    }))
    .sort((a, b) => {
      const byLote = (a.numeroLote ?? '').localeCompare(b.numeroLote ?? '', 'es', {
        numeric: true,
      })
      if (byLote !== 0) return byLote
      return a.articulo.localeCompare(b.articulo, 'es')
    })

  const items: PickRollo[] = ((prRaw ?? []) as unknown as PedidoRolloRaw[])
    .filter((r) => r.rollos != null)
    .map((r) => ({
      pedido_rollo_id: r.id,
      pedido_partida_id: r.pedido_partida_id,
      pickeado_at: r.pickeado_at,
      rollo_id: r.rollos!.id,
      numero_pieza: r.rollos!.numero_pieza,
      ubicacion: r.rollos!.ubicacion,
      kilos: r.rollos!.kilos,
      articulo_id: r.rollos!.articulo_id,
      color_id: r.rollos!.color_id,
      articulo: r.rollos!.articulos?.nombre ?? null,
      color: r.rollos!.color_id ? colorById.get(r.rollos!.color_id) ?? null : null,
    }))

  const tintoreriaIds = Array.from(
    new Set(
      ((partidasRaw ?? []) as unknown as PedidoPartidaRaw[])
        .map((p) => p.ingresos?.tintoreria_id)
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

  const estado = ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente
  const totalSolicitado = partidas.reduce((acc, p) => acc + p.rollosSolicitados, 0)
  const totalPickeado = items.length
  const kilosReales = items.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0)

  const pickeable = pedido.estado === 'pendiente' || pedido.estado === 'en_preparacion'
  const listo = pedido.estado === 'lista'

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href="/picking" label="Volver a picking" />
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">
            Picking - {pedido.cliente}
          </h1>
          <span className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}>
            {estado.text}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {totalPickeado}/{totalSolicitado} rollos - {kilosReales.toFixed(2)} kg reales
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pedido {pedido.numero_pedido ?? '-'} - el peso final sale de los rollos escaneados
        </p>
      </div>

      {pickeable ? (
        <PickingScanner
          pedidoId={id}
          partidas={partidas}
          items={items}
          alternativas={[]}
          patrones={patronesData ?? []}
          readerType={readerType}
        />
      ) : listo ? (
        <ConfirmarEgresoCard pedidoId={id} />
      ) : (
        <div className="rounded-lg border bg-success/10 border-success/30 p-5 text-center space-y-2">
          <p className="font-semibold text-success">
            {ESTADO_LABEL[pedido.estado]?.text ?? pedido.estado}
          </p>
          <p className="text-sm text-muted-foreground">
            Este pedido ya no esta en etapa de picking.
          </p>
        </div>
      )}
    </div>
  )
}
