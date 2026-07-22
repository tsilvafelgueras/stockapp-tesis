import Link from 'next/link'
import { Suspense } from 'react'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import HistorialFilters from './HistorialFilters'

const PAGE_SIZE = 20

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

export default async function PickingHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    cliente?: string
    desde?: string
    hasta?: string
  }>
}) {
  const { page: pageParam, cliente, desde, hasta } = await searchParams

  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
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
      `,
      { count: 'exact' }
    )
    .in('estado', ['confirmada_egreso', 'cancelada', 'entregada'])
    .order('confirmada_egreso_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (cliente?.trim()) {
    query = query.ilike('cliente', `%${cliente.trim()}%`)
  }
  if (desde) {
    query = query.gte('confirmada_egreso_at', desde)
  }
  if (hasta) {
    query = query.lte('confirmada_egreso_at', hasta + 'T23:59:59')
  }

  const { data, count } = await query

  const pedidos = (data ?? []) as unknown as PedidoHistorial[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildHref(page: number) {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (cliente?.trim()) params.set('cliente', cliente.trim())
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const qs = params.toString()
    return `/picking/historial${qs ? '?' + qs : ''}`
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <BackButton href="/picking" label="Volver a picking" />
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">
          Historial de depósito
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos con salida confirmada, entregados o cancelados.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <Suspense fallback={null}>
          <HistorialFilters />
        </Suspense>
      </section>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-semibold">
            {total > 0
              ? `${total} pedido${total !== 1 ? 's' : ''}`
              : 'Pedidos'}
          </h2>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
            </p>
          )}
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
              Ningún pedido coincide con los filtros.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-zinc-50 px-4 py-3">
            {currentPage > 1 ? (
              <Link
                href={buildHref(currentPage - 1)}
                className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <p className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </p>
            {currentPage < totalPages ? (
              <Link
                href={buildHref(currentPage + 1)}
                className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              >
                Siguiente →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
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
