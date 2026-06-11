import { describe, it, expect } from 'vitest'
import { buildUbicacionesSugeridas, type StockOrientacionRaw } from './picking'

const partida = {
  articulo_id: 'articulo-1',
  color_id: 'color-1',
  ingreso_id: 'ingreso-1',
}

function row(
  ubicacion: string | null,
  ingreso_id = 'ingreso-1',
  lote: string | null = null,
  articulo_id = 'articulo-1',
  color_id = 'color-1'
): StockOrientacionRaw {
  return {
    articulo_id,
    color_id,
    ingreso_id,
    ubicacion,
    ingresos: { numero_lote: lote },
  }
}

describe('buildUbicacionesSugeridas', () => {
  it('sugiere ubicaciones con stock del mismo articulo, color e ingreso (partida)', () => {
    const stock = [row('F15'), row('F2')]

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: ['F2', 'F15'],
      reemplazos: [],
    })
  })

  it('separa en "reemplazos" las ubicaciones de stock de otro lote, con su numero de lote', () => {
    const stock = [row('F15'), row('F99', 'ingreso-OTRO', 'LOTE-123')]

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: ['F15'],
      reemplazos: [{ ubicacion: 'F99', lote: 'LOTE-123' }],
    })
  })

  it('ignora filas de otro articulo o color', () => {
    const stock = [
      row('F1', 'ingreso-1', null, 'articulo-OTRO'),
      row('F2', 'ingreso-1', null, 'articulo-1', 'color-OTRO'),
      row('F3'),
    ]

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: ['F3'],
      reemplazos: [],
    })
  })

  it('ignora filas sin ubicacion y deduplica', () => {
    const stock = [row(null), row('F1'), row('F1')]

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: ['F1'],
      reemplazos: [],
    })
  })

  it('limita cada lista a 4 ubicaciones, ordenadas naturalmente', () => {
    const stock = ['F10', 'F1', 'F2', 'F20', 'F3'].map((u) => row(u))

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: ['F1', 'F2', 'F3', 'F10'],
      reemplazos: [],
    })
  })

  it('devuelve listas vacias si no hay stock disponible que coincida', () => {
    const stock = [row('F1', 'ingreso-1', null, 'articulo-OTRO')]

    expect(buildUbicacionesSugeridas(partida, stock)).toEqual({
      ubicaciones: [],
      reemplazos: [],
    })
  })
})
