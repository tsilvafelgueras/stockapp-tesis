import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ResumenDiaPedidos = {
  rollosPedidos: number
  kilosPedidos: number
  rollosEnviados: number
  kilosEnviados: number
}

/** Ventana del día actual [hoy 00:00, mañana 00:00) en ISO. */
function ventanaHoy(): { desde: string; hasta: string } {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)
  return { desde: inicio.toISOString(), hasta: fin.toISOString() }
}

type PedidoRolloKilos = { rollos: { kilos: number | null } | null }

/** Cuenta rollos + suma kilos de los pedido_rollos de un set de pedidos. */
async function contarRollos(
  supabase: SupabaseClient,
  pedidoIds: string[]
): Promise<{ rollos: number; kilos: number }> {
  if (pedidoIds.length === 0) return { rollos: 0, kilos: 0 }
  const { data } = await supabase
    .from('pedido_rollos')
    .select('rollos ( kilos )')
    .in('pedido_id', pedidoIds)
  const filas = (data ?? []) as unknown as PedidoRolloKilos[]
  const kilos = filas.reduce((acc, f) => acc + Number(f.rollos?.kilos ?? 0), 0)
  return { rollos: filas.length, kilos }
}

/**
 * Resumen de actividad del día para los dashboards:
 * - rollosPedidos: rollos de pedidos CREADOS hoy (excluye cancelados).
 * - rollosEnviados: rollos de pedidos con SALIDA CONFIRMADA hoy
 *   (`confirmada_egreso_at` dentro del día; queda seteado aunque luego se
 *   entregue, así que cubre "salida confirmada/entregada hoy").
 *
 * RLS filtra por empresa del lado de la base.
 */
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
    contarRollos(supabase, (pedidosCreados ?? []).map((p) => p.id as string)),
    contarRollos(supabase, (pedidosEnviados ?? []).map((p) => p.id as string)),
  ])

  return {
    rollosPedidos: pedidos.rollos,
    kilosPedidos: pedidos.kilos,
    rollosEnviados: enviados.rollos,
    kilosEnviados: enviados.kilos,
  }
}
