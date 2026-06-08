import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'

type PedidoHistorial = {
  id: string
  numero_pedido: string | null
  cliente: string
  estado: string
  created_at: string
  confirmada_egreso_at: string | null
  numero_remito_externo: string | null
  numero_remito_salida: string | null
  pedido_rollos: { id: string; rollo_id: string | null }[] | null
}

export default async function PickingHistorialPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        estado,
        created_at,
        confirmada_egreso_at,
        numero_remito_externo,
        numero_remito_salida,
        pedido_rollos ( id, rollo_id )
      `
    )
    .in('estado', ['confirmada_egreso', 'cancelada', 'entregada'])
    .order('confirmada_egreso_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(60)

  const pedidos = (data ?? []) as unknown as PedidoHistorial[]

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <BackButton href="/picking" label="Volver a picking" />
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">
          Historial de depósito
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimos pedidos con salida confirmada o cancelados.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-semibold">Pedidos recientes</h2>
        </div>
        <div className="divide-y">
          {pedidos.length > 0 ? (
            pedidos.map((p) => {
              const rollos =
                p.pedido_rollos?.filter((pr) => pr.rollo_id != null).length ?? 0
              return (
                <Link
                  key={p.id}
                  href={`/picking/${p.id}`}
                  className="grid gap-2 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      Pedido {p.numero_pedido ?? '-'} · {p.cliente}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {estadoLabel(p.estado)}
                      {p.confirmada_egreso_at
                        ? ` · ${new Date(p.confirmada_egreso_at).toLocaleString('es-AR')}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-left text-xs text-muted-foreground sm:text-right">
                    <p>{rollos} rollos</p>
                    <p>
                      Remito:{' '}
                      {p.numero_remito_salida ?? p.numero_remito_externo ?? '-'}
                    </p>
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay pedidos en el historial.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function estadoLabel(estado: string) {
  switch (estado) {
    case 'confirmada_egreso':
    case 'entregada':
      return 'Egreso confirmado'
    case 'cancelada':
      return 'Cancelado'
    default:
      return estado
  }
}
