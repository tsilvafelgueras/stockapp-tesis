import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardBackButton from '@/components/DashboardBackButton'
import { estadoPedidoBadge } from '@/lib/estadoPedido'

type Row = {
  id: string
  numero_pedido: string | null
  cliente: string
  estado: string
  created_at: string
  pedido_partidas:
    | { id: string; rollos_solicitados: number; pedido_rollos: { id: string; liberado_at: string | null }[] | null }[]
    | null
}

export default async function PickingListPage() {
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        estado,
        created_at,
        pedido_partidas (
          id,
          rollos_solicitados,
          pedido_rollos ( id, liberado_at )
        )
      `
    )
    .in('estado', ['pendiente', 'en_preparacion', 'lista'])
    .order('created_at', { ascending: true })

  const rows = (pedidos ?? []) as unknown as Row[]
  const listos = rows.filter((p) => p.estado === 'lista')
  const aPreparar = rows.filter((p) => p.estado !== 'lista')

  const { data: recientesRaw } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, cliente, estado, confirmada_egreso_at, numero_remito_salida')
    .eq('estado', 'confirmada_egreso')
    .order('confirmada_egreso_at', { ascending: false })
    .limit(5)

  const recientes = (recientesRaw ?? []) as {
    id: string
    numero_pedido: string | null
    cliente: string
    confirmada_egreso_at: string | null
    numero_remito_salida: string | null
  }[]

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Picking</h1>
          <Link
            href="/picking/historial"
            className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Historial
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pedidos a preparar y pedidos listos para confirmar egreso.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center space-y-2 shadow-sm">
          <p className="font-medium">Todo al dia</p>
          <p className="text-sm text-muted-foreground">
            No hay pedidos esperando deposito.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Pedidos a preparar</h2>
          {aPreparar.length > 0 ? (
            <div className="space-y-3">
              {aPreparar.map((p) => (
                <PedidoCard key={p.id} pedido={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-5 text-center text-sm text-muted-foreground shadow-sm">
              No hay pedidos pendientes de picking.
            </div>
          )}
        </section>
      )}

      {listos.length > 0 && (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-success">
                Listos para salida fisica
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Falta confirmar que la mercaderia salio del deposito.
              </p>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-success">
              {listos.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {listos.map((p) => (
              <PedidoCard key={p.id} pedido={p} cta="Confirmar salida" />
            ))}
          </div>
        </section>
      )}

      {recientes.length > 0 && (
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Ultimas salidas confirmadas</h2>
          <div className="mt-3 divide-y text-sm">
            {recientes.map((p) => (
              <Link
                key={p.id}
                href={`/picking/${p.id}`}
                className="flex items-center justify-between gap-3 py-2 hover:text-action"
              >
                <span className="min-w-0 truncate">
                  Pedido {p.numero_pedido ?? '-'} - {p.cliente}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.confirmada_egreso_at
                    ? new Date(p.confirmada_egreso_at).toLocaleDateString('es-AR')
                    : '-'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PedidoCard({ pedido, cta }: { pedido: Row; cta?: string }) {
  const estado = estadoPedidoBadge(pedido.estado)
  const total =
    pedido.pedido_partidas?.reduce(
      (acc, pp) => acc + Number(pp.rollos_solicitados ?? 0),
      0
    ) ?? 0
  const pickeados =
    pedido.pedido_partidas?.reduce(
      (acc, pp) =>
        acc +
        (pp.pedido_rollos?.filter((pr) => pr.liberado_at == null).length ?? 0),
      0
    ) ?? 0
  const pct = total > 0 ? Math.round((pickeados / total) * 100) : 0

  return (
    <Link
      href={`/picking/${pedido.id}`}
      className="block rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{pedido.cliente}</p>
          <p className="text-xs text-muted-foreground">
            Pedido {pedido.numero_pedido ?? '-'} -{' '}
            {new Date(pedido.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>
        <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}>
          {cta ?? estado.text}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {pickeados} de {total} rollos pickeados
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  )
}
