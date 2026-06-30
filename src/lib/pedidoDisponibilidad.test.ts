import { describe, expect, it } from 'vitest'
import {
  demandaPendientePorPartida,
  keyPartida,
  type DemandaPartidaRow,
} from './pedidoDisponibilidad'

function row(
  solicitados: number,
  pickeados: number,
  liberados = 0,
  opts: { ingreso?: string; articulo?: string; color?: string } = {}
): DemandaPartidaRow {
  const pedido_rollos = [
    ...Array.from({ length: pickeados }, () => ({ liberado_at: null })),
    ...Array.from({ length: liberados }, () => ({
      liberado_at: '2026-06-24T00:00:00Z',
    })),
  ]
  return {
    ingreso_id: opts.ingreso ?? 'ing-1',
    articulo_id: opts.articulo ?? 'art-1',
    color_id: opts.color ?? 'col-1',
    rollos_solicitados: solicitados,
    pedido_rollos,
  }
}

describe('demandaPendientePorPartida', () => {
  it('regresión L-2026-115: demanda totalmente pickeada → pendiente 0', () => {
    // Pedido 00067 (12 solicitados, 12 pickeados) + 00068 (2 y 2) sobre la misma
    // partida → 0 pendiente, así los 9 en_stock quedan libres.
    const map = demandaPendientePorPartida([row(12, 12), row(2, 2)])
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(0)
  })

  it('demanda parcialmente pickeada → pendiente = solicitados − pickeados', () => {
    const map = demandaPendientePorPartida([row(9, 4)])
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(5)
  })

  it('sin pickear → pendiente = solicitados', () => {
    const map = demandaPendientePorPartida([row(3, 0)])
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(3)
  })

  it('rollos liberados no cuentan como pickeados', () => {
    // 5 solicitados, 2 pickeados activos, 3 liberados (ya no cuentan).
    const map = demandaPendientePorPartida([row(5, 2, 3)])
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(3)
  })

  it('suma la demanda pendiente de varias líneas de la misma partida', () => {
    const map = demandaPendientePorPartida([row(4, 1), row(3, 0)])
    // (4-1) + (3-0) = 6
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(6)
  })

  it('separa partidas distintas por key', () => {
    const map = demandaPendientePorPartida([
      row(5, 1, 0, { ingreso: 'ing-A' }),
      row(2, 0, 0, { ingreso: 'ing-B' }),
    ])
    expect(map.get(keyPartida('ing-A', 'art-1', 'col-1'))).toBe(4)
    expect(map.get(keyPartida('ing-B', 'art-1', 'col-1'))).toBe(2)
  })

  it('sobre-pickeado nunca da negativo', () => {
    const map = demandaPendientePorPartida([row(2, 5)])
    expect(map.get(keyPartida('ing-1', 'art-1', 'col-1'))).toBe(0)
  })

  it('lista vacía → mapa vacío', () => {
    expect(demandaPendientePorPartida([]).size).toBe(0)
  })
})
