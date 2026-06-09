import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PedidosFilters from './PedidosFilters'

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
  entregada: { text: 'Egreso confirmado', className: 'bg-zinc-100 text-zinc-700' },
  cancelada: {
    text: 'Cancelada',
    className: 'bg-destructive/15 text-destructive',
  },
}

type SearchParams = {
  estado?: string
  cliente_id?: string
  desde?: string
  hasta?: string
  q?: string
  demorados?: string
}

type PedidoRow = {
  id: string
  numero_pedido: string | null
  cliente: string
  numero_remito_externo: string | null
  numero_remito_salida: string | null
  fecha_entrega_comprometida: string | null
  estado: string
  created_at: string
  pedido_rollos: { rollos: { kilos: number | null } | null }[] | null
  pedido_partidas: { rollos_solicitados: number }[] | null
}

export default async function PedidosListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyIso = hoy.toISOString().slice(0, 10)

  let query = supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        numero_remito_externo,
        numero_remito_salida,
        fecha_entrega_comprometida,
        estado,
        created_at,
        pedido_partidas ( rollos_solicitados ),
        pedido_rollos ( rollos ( kilos ) )
      `
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (sp.demorados === '1') {
    query = query
      .in('estado', ['pendiente', 'en_preparacion', 'lista'])
      .lt('fecha_entrega_comprometida', hoyIso)
  } else if (sp.estado) {
    query = query.eq('estado', sp.estado)
  }
  if (sp.cliente_id) query = query.eq('cliente_id', sp.cliente_id)
  if (sp.desde) query = query.gte('created_at', sp.desde)
  if (sp.hasta) {
    const hasta = new Date(sp.hasta)
    hasta.setDate(hasta.getDate() + 1)
    query = query.lt('created_at', hasta.toISOString().slice(0, 10))
  }
  if (sp.q) {
    const term = sp.q.trim()
    query = query.or(
      `numero_pedido.ilike.%${term}%,numero_remito_externo.ilike.%${term}%,numero_remito_salida.ilike.%${term}%`
    )
  }

  const { data: pedidos, error } = await query

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const rows = (pedidos ?? []) as unknown as PedidoRow[]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Reservas de rollos para clientes
          </p>
        </div>
        <Link
          href="/pedidos/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center"
        >
          + Nuevo pedido
        </Link>
      </div>

      <PedidosFilters
        clientes={clientes ?? []}
        current={{
          estado: sp.estado ?? '',
          cliente_id: sp.cliente_id ?? '',
          desde: sp.desde ?? '',
          hasta: sp.hasta ?? '',
          q: sp.q ?? '',
          demorados: sp.demorados ?? '',
        }}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar los pedidos: {error.message}
        </div>
      )}

      <div className="sm:hidden space-y-3">
        {rows.length > 0 ? (
          rows.map((p) => (
            <PedidoCardMobile key={p.id} pedido={p} hoyIso={hoyIso} />
          ))
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Todavia no hay pedidos.
          </div>
        )}
      </div>

      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nro Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Rollos</th>
                <th className="px-4 py-3 font-medium">Kilos</th>
                <th className="px-4 py-3 font-medium">Remitos</th>
                <th className="px-4 py-3 font-medium">Compromiso</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((p) => (
                  <PedidoRowDesktop key={p.id} pedido={p} hoyIso={hoyIso} />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavia no hay pedidos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PedidoCardMobile({
  pedido,
  hoyIso,
}: {
  pedido: PedidoRow
  hoyIso: string
}) {
  const estado = ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente
  const cantidadSolicitada = totalRollosSolicitados(pedido)
  const kilos = totalKilosReal(pedido)
  const demorado = pedidoDemorado(pedido, hoyIso)

  return (
    <Link
      href={`/pedidos/${pedido.id}`}
      className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{pedido.cliente}</p>
          <p className="text-xs text-muted-foreground">
            Pedido {pedido.numero_pedido ?? '-'} -{' '}
            {new Date(pedido.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>
        <span className="flex flex-wrap justify-end gap-1.5">
          <span
            className={`flex-shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
          >
            {estado.text}
          </span>
          {demorado && (
            <span className="flex-shrink-0 text-xs rounded-full px-2 py-0.5 bg-destructive/15 text-destructive">
              Demorado
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {cantidadSolicitada} {cantidadSolicitada === 1 ? 'rollo' : 'rollos'} solicitados
        </span>
        <span className="tabular-nums">
          {kilos > 0 ? `${kilos.toFixed(2)} kg reales` : 'kg reales pendientes'}
        </span>
        {pedido.numero_remito_externo && (
          <span>Rem: {pedido.numero_remito_externo}</span>
        )}
        {pedido.fecha_entrega_comprometida && (
          <span>
            Compromiso:{' '}
            {new Date(pedido.fecha_entrega_comprometida).toLocaleDateString(
              'es-AR'
            )}
          </span>
        )}
      </div>
    </Link>
  )
}

function PedidoRowDesktop({
  pedido,
  hoyIso,
}: {
  pedido: PedidoRow
  hoyIso: string
}) {
  const estado = ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente
  const cantidad = totalRollosSolicitados(pedido)
  const kilos = totalKilosReal(pedido)
  const href = `/pedidos/${pedido.id}`
  const demorado = pedidoDemorado(pedido, hoyIso)

  return (
    <tr className="border-b last:border-0 hover:bg-zinc-50">
      <td className="font-medium">
        <Link href={href} className="block px-4 py-3 hover:underline">
          {pedido.numero_pedido ?? '-'}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3">
          {pedido.cliente}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3 text-muted-foreground">
          {new Date(pedido.created_at).toLocaleDateString('es-AR')}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3 tabular-nums">
          {cantidad}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3 tabular-nums">
          {kilos > 0 ? `${kilos.toFixed(2)} kg reales` : 'Pendiente'}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3 text-muted-foreground">
          <div>{pedido.numero_remito_externo ?? '-'}</div>
          {pedido.numero_remito_salida && (
            <div className="text-xs">Salida: {pedido.numero_remito_salida}</div>
          )}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3 text-muted-foreground">
          {pedido.fecha_entrega_comprometida
            ? new Date(pedido.fecha_entrega_comprometida).toLocaleDateString(
                'es-AR'
              )
            : '-'}
        </Link>
      </td>
      <td>
        <Link href={href} className="block px-4 py-3">
          <span className="flex flex-wrap gap-1.5">
            <span
              className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
            >
              {estado.text}
            </span>
            {demorado && (
              <span className="text-xs rounded-full px-2 py-0.5 bg-destructive/15 text-destructive">
                Demorado
              </span>
            )}
          </span>
        </Link>
      </td>
    </tr>
  )
}

function totalRollosSolicitados(pedido: PedidoRow): number {
  const porPartidas =
    pedido.pedido_partidas?.reduce(
      (acc, pp) => acc + Number(pp.rollos_solicitados ?? 0),
      0
    ) ?? 0
  return porPartidas > 0 ? porPartidas : pedido.pedido_rollos?.length ?? 0
}

function totalKilosReal(pedido: PedidoRow): number {
  return (
    pedido.pedido_rollos?.reduce(
      (acc, pr) => acc + Number(pr.rollos?.kilos ?? 0),
      0
    ) ?? 0
  )
}

function pedidoDemorado(pedido: PedidoRow, hoyIso: string): boolean {
  if (!pedido.fecha_entrega_comprometida) return false
  if (!['pendiente', 'en_preparacion', 'lista'].includes(pedido.estado)) {
    return false
  }
  return pedido.fecha_entrega_comprometida < hoyIso
}
