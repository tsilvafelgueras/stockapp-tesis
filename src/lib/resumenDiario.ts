import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ResumenDiaPedidos = {
  rollosPedidos: number
  rollosEnviados: number
  kilosEnviados: number
}

function ventanaHoy(): { desde: string; hasta: string } {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)
  return { desde: inicio.toISOString(), hasta: fin.toISOString() }
}

type PedidoPartidaRollos = {
  rollos_solicitados: number | null
}

type PedidoRolloKilos = { rollos: { kilos: number | null } | null }

async function contarSolicitados(
  supabase: SupabaseClient,
  pedidoIds: string[]
): Promise<{ rollos: number }> {
  if (pedidoIds.length === 0) return { rollos: 0 }
  const { data } = await supabase
    .from('pedido_partidas')
    .select('rollos_solicitados')
    .in('pedido_id', pedidoIds)
  const filas = (data ?? []) as unknown as PedidoPartidaRollos[]
  return {
    rollos: filas.reduce((acc, f) => acc + Number(f.rollos_solicitados ?? 0), 0),
  }
}

async function contarReales(
  supabase: SupabaseClient,
  pedidoIds: string[]
): Promise<{ rollos: number; kilos: number }> {
  if (pedidoIds.length === 0) return { rollos: 0, kilos: 0 }
  const { data } = await supabase
    .from('pedido_rollos')
    .select('rollos ( kilos )')
    .in('pedido_id', pedidoIds)
    .is('liberado_at', null)
  const filas = (data ?? []) as unknown as PedidoRolloKilos[]
  const kilos = filas.reduce((acc, f) => acc + Number(f.rollos?.kilos ?? 0), 0)
  return { rollos: filas.length, kilos }
}

export async function getResumenDiaPedidos(
  supabase: SupabaseClient
): Promise<ResumenDiaPedidos> {
  const { desde, hasta } = ventanaHoy()

  const [{ data: pedidosCreados }, { data: pedidosEnviados }] =
    await Promise.all([
      supabase
        .from('pedidos')
        .select('id')
        .neq('estado', 'cancelada')
        .gte('created_at', desde)
        .lt('created_at', hasta),
      supabase
        .from('pedidos')
        .select('id')
        .gte('confirmada_egreso_at', desde)
        .lt('confirmada_egreso_at', hasta),
    ])

  const [pedidos, enviados] = await Promise.all([
    contarSolicitados(supabase, (pedidosCreados ?? []).map((p) => p.id as string)),
    contarReales(supabase, (pedidosEnviados ?? []).map((p) => p.id as string)),
  ])

  return {
    rollosPedidos: pedidos.rollos,
    rollosEnviados: enviados.rollos,
    kilosEnviados: enviados.kilos,
  }
}
