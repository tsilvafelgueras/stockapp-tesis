// Cálculo puro de la "demanda pendiente por partida" para las pantallas de
// armado de pedidos (nuevo pedido y agregar rollos). Sin dependencias de
// Supabase/React para poder testearlo con vitest.
//
// Una partida (ingreso + artículo + color) puede tener demanda de varios pedidos
// activos (pedido_partidas.rollos_solicitados). Parte de esa demanda ya puede
// estar cubierta físicamente: cuando el operario pickea un rollo, este pasa a
// estado 'reservado' y SALE de la lista de `en_stock`. Por eso, para saber
// cuántos rollos `en_stock` siguen comprometidos (y no se pueden volver a
// vender), hay que descontar de los solicitados los que ya fueron pickeados:
//
//   demanda_pendiente = max(0, rollos_solicitados − pickeados_activos)
//
// Si en cambio se descuenta la demanda completa, se cuentan dos veces los rollos
// ya pickeados (que ya no están en `en_stock`) y se esconden rollos realmente
// libres. Esta es la misma definición que usa el resumen de stock
// (ver src/lib/stockResumen.ts).

export type DemandaPartidaRow = {
  ingreso_id: string
  articulo_id: string
  color_id: string
  rollos_solicitados: number
  pedido_rollos: { liberado_at: string | null }[] | null
}

export function keyPartida(
  ingresoId: string,
  articuloId: string,
  colorId: string
): string {
  return `${ingresoId}|${articuloId}|${colorId}`
}

/**
 * Mapa key-de-partida → demanda pendiente (rollos solicitados todavía sin
 * pickear). Suma la demanda pendiente de cada línea de pedido_partidas que
 * comparte la misma partida.
 */
export function demandaPendientePorPartida(
  rows: DemandaPartidaRow[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    const solicitados = Number(r.rollos_solicitados ?? 0)
    const pickeados = (r.pedido_rollos ?? []).filter(
      (pr) => pr.liberado_at == null
    ).length
    const pendiente = Math.max(0, solicitados - pickeados)
    const key = keyPartida(r.ingreso_id, r.articulo_id, r.color_id)
    map.set(key, (map.get(key) ?? 0) + pendiente)
  }
  return map
}
