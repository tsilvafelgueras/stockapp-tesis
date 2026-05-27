import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PedidosFilters from './PedidosFilters'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Lista', className: 'bg-success/15 text-success' },
  confirmada_egreso: {
    text: 'Egreso confirmado',
    className: 'bg-primary/15 text-primary',
  },
  entregada: { text: 'Entregada', className: 'bg-zinc-100 text-zinc-700' },
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
}

export default async function PedidosListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams

  let query = supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        numero_remito_externo,
        estado,
        created_at,
        pedido_rollos ( rollos ( kilos ) )
      `
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (sp.estado) query = query.eq('estado', sp.estado)
  if (sp.cliente_id) query = query.eq('cliente_id', sp.cliente_id)
  if (sp.desde) query = query.gte('created_at', sp.desde)
  if (sp.hasta) {
    // Inclusivo del día 'hasta': sumamos 1 día y usamos lt.
    const hasta = new Date(sp.hasta)
    hasta.setDate(hasta.getDate() + 1)
    query = query.lt('created_at', hasta.toISOString().slice(0, 10))
  }
  if (sp.q) {
    const term = sp.q.trim()
    query = query.or(
      `numero_pedido.ilike.%${term}%,numero_remito_externo.ilike.%${term}%`
    )
  }

  const { data: pedidos, error } = await query

  // Catálogo de clientes para el dropdown del filtro.
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  type PedidoRow = {
    id: string
    numero_pedido: string | null
    cliente: string
    numero_remito_externo: string | null
    estado: string
    created_at: string
    pedido_rollos:
      | { rollos: { kilos: number | null } | null }[]
      | null
  }
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
        }}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar los pedidos: {error.message}
        </div>
      )}

      {/* Mobile: cards */}
      <div className="sm:hidden space-y-3">
        {rows.length > 0 ? (
          rows.map((p) => {
            const estado = ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.pendiente
            const cantidad = p.pedido_rollos?.length ?? 0
            const kilos =
              p.pedido_rollos?.reduce(
                (acc, pr) => acc + Number(pr.rollos?.kilos ?? 0),
                0
              ) ?? 0
            return (
              <Link
                key={p.id}
                href={`/pedidos/${p.id}`}
                className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {p.cliente}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pedido {p.numero_pedido ?? '—'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                  >
                    {estado.text}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {cantidad} {cantidad === 1 ? 'rollo' : 'rollos'}
                  </span>
                  {kilos > 0 && (
                    <span className="tabular-nums">{kilos.toFixed(2)} kg</span>
                  )}
                  {p.numero_remito_externo && (
                    <span>Rem: {p.numero_remito_externo}</span>
                  )}
                </div>
              </Link>
            )
          })
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Todavía no hay pedidos.
          </div>
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N° Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Rollos</th>
                <th className="px-4 py-3 font-medium">Kilos</th>
                <th className="px-4 py-3 font-medium">Remito</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((p) => {
                  const estado =
                    ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.pendiente
                  const cantidad = p.pedido_rollos?.length ?? 0
                  const kilos =
                    p.pedido_rollos?.reduce(
                      (acc, pr) => acc + Number(pr.rollos?.kilos ?? 0),
                      0
                    ) ?? 0
                  const href = `/pedidos/${p.id}`
                  return (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-zinc-50"
                    >
                      <td className="font-medium">
                        <Link href={href} className="block px-4 py-3 hover:underline">
                          {p.numero_pedido ?? '—'}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3">
                          {p.cliente}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3 text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3 tabular-nums">
                          {cantidad}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3 tabular-nums">
                          {kilos > 0 ? `${kilos.toFixed(2)} kg` : '—'}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3 text-muted-foreground">
                          {p.numero_remito_externo ?? '—'}
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className="block px-4 py-3">
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                          >
                            {estado.text}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavía no hay pedidos.
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
