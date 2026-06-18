import { describe, expect, it } from 'vitest'
import {
  buildReservaBanner,
  buildStockSummary,
  type ReservaResumenRow,
  type StockResumenRow,
} from './stockResumen'

const colorById = new Map([
  ['col-negro', { id: 'col-negro', nombre: 'Negro' }],
  ['col-blanco', { id: 'col-blanco', nombre: 'Blanco' }],
])

// Helpers para armar filas con menos ruido.
let rolloSeq = 0
function rollo(
  estado: 'en_stock' | 'reservado',
  opts: {
    articulo?: string
    color?: string
    ingreso?: string
    lote?: string
    kilos?: number
  } = {}
): StockResumenRow {
  const articulo = opts.articulo ?? 'art-1'
  const color = opts.color ?? 'col-negro'
  const ingreso = opts.ingreso ?? 'ing-1'
  return {
    id: `r-${rolloSeq++}`,
    kilos: opts.kilos ?? 10,
    estado,
    articulo_id: articulo,
    color_id: color,
    ubicacion: null,
    articulos: { id: articulo, nombre: articulo },
    ingresos: {
      id: ingreso,
      numero_lote: opts.lote ?? ingreso,
      tintoreria_id: null,
    },
  }
}

function demanda(
  cantidad: number,
  opts: {
    articulo?: string
    color?: string
    ingreso?: string
    lote?: string
  } = {}
): ReservaResumenRow {
  const articulo = opts.articulo ?? 'art-1'
  const color = opts.color ?? 'col-negro'
  const ingreso = opts.ingreso ?? 'ing-1'
  return {
    ingreso_id: ingreso,
    articulo_id: articulo,
    color_id: color,
    rollos_solicitados: cantidad,
    articulos: { id: articulo, nombre: articulo },
    ingresos: {
      id: ingreso,
      numero_lote: opts.lote ?? ingreso,
      tintoreria_id: null,
    },
  }
}

describe('buildStockSummary', () => {
  it('regresión del bug: 1 en_stock + 1 reservado + demanda 1 → Rollos=2, Reservado=1, Libre=1 y cierra', () => {
    const summary = buildStockSummary(
      [rollo('en_stock'), rollo('reservado')],
      [demanda(1)],
      colorById
    )

    expect(summary).toHaveLength(1)
    const g = summary[0]
    expect(g.rollos).toBe(2)
    expect(g.reservado).toBe(1)
    expect(g.libre).toBe(1)
    // Invariante central que el bug original violaba.
    expect(g.libre + g.reservado).toBe(g.rollos)
  })

  it('un rollo reservado nunca cuenta como libre', () => {
    const summary = buildStockSummary([rollo('reservado')], [], colorById)
    const g = summary[0]
    expect(g.libre).toBe(0)
    expect(g.reservado).toBe(1)
    expect(g.rollos).toBe(1)
  })

  it('demanda pendiente sin pickear reduce Libre', () => {
    // 3 en_stock, sin pickeados, demanda 2 → 1 libre, 2 reservados.
    const summary = buildStockSummary(
      [rollo('en_stock'), rollo('en_stock'), rollo('en_stock')],
      [demanda(2)],
      colorById
    )
    const g = summary[0]
    expect(g.libre).toBe(1)
    expect(g.reservado).toBe(2)
    expect(g.rollos).toBe(3)
    expect(g.libre + g.reservado).toBe(g.rollos)
  })

  it('demanda ya satisfecha por un pickeado no se descuenta dos veces', () => {
    // 1 en_stock + 1 reservado, demanda 1 (cubierta por el reservado).
    // El en_stock debe quedar LIBRE (sin el doble descuento del bug viejo).
    const summary = buildStockSummary(
      [rollo('en_stock'), rollo('reservado')],
      [demanda(1)],
      colorById
    )
    const g = summary[0]
    expect(g.libre).toBe(1)
    expect(g.reservado).toBe(1)
  })

  it('sin demanda: Libre = en_stock, Reservado = pickeados', () => {
    const summary = buildStockSummary(
      [rollo('en_stock'), rollo('en_stock'), rollo('reservado')],
      [],
      colorById
    )
    const g = summary[0]
    expect(g.libre).toBe(2)
    expect(g.reservado).toBe(1)
    expect(g.rollos).toBe(3)
  })

  it('sobre-demanda se acota a lo físicamente disponible (sigue cerrando)', () => {
    // 1 en_stock, sin pickeados, demanda 5 → libre 0, reservado 1.
    const summary = buildStockSummary([rollo('en_stock')], [demanda(5)], colorById)
    const g = summary[0]
    expect(g.libre).toBe(0)
    expect(g.reservado).toBe(1)
    expect(g.rollos).toBe(1)
    expect(g.libre + g.reservado).toBe(g.rollos)
  })

  it('sustitución entre partidas del mismo artículo+color cierra a nivel grupo', () => {
    // Partida A: 1 reservado (rollo pickeado como sustituto).
    // Partida B: 1 en_stock + demanda 1 (cubierta por el sustituto de A).
    // A nivel grupo: en_stock=1, pickeados=1, demanda=1 → libre=1, reservado=1.
    const summary = buildStockSummary(
      [
        rollo('reservado', { ingreso: 'ing-A', lote: 'A' }),
        rollo('en_stock', { ingreso: 'ing-B', lote: 'B' }),
      ],
      [demanda(1, { ingreso: 'ing-B', lote: 'B' })],
      colorById
    )
    expect(summary).toHaveLength(1)
    const g = summary[0]
    expect(g.rollos).toBe(2)
    expect(g.libre).toBe(1)
    expect(g.reservado).toBe(1)
    expect(g.libre + g.reservado).toBe(g.rollos)
  })

  it('separa grupos por artículo+color', () => {
    const summary = buildStockSummary(
      [
        rollo('en_stock', { color: 'col-negro' }),
        rollo('en_stock', { color: 'col-blanco' }),
      ],
      [],
      colorById
    )
    expect(summary).toHaveLength(2)
    expect(summary.map((g) => g.color).sort()).toEqual(['Blanco', 'Negro'])
  })
})

describe('buildReservaBanner', () => {
  it('devuelve null sin lote', () => {
    const summary = buildStockSummary([rollo('en_stock')], [], colorById)
    expect(buildReservaBanner(summary, undefined)).toBeNull()
  })

  it('agrega rollos/reservado/libre del lote filtrado', () => {
    const summary = buildStockSummary(
      [
        rollo('en_stock', { ingreso: 'ing-1', lote: 'L1' }),
        rollo('reservado', { ingreso: 'ing-1', lote: 'L1' }),
      ],
      [demanda(1, { ingreso: 'ing-1', lote: 'L1' })],
      colorById
    )
    const banner = buildReservaBanner(summary, 'L1')
    expect(banner).not.toBeNull()
    expect(banner!.rollos).toBe(2)
    expect(banner!.reservado).toBe(1)
    expect(banner!.libre).toBe(1)
  })

  it('devuelve null si el lote no aparece', () => {
    const summary = buildStockSummary(
      [rollo('en_stock', { lote: 'L1' })],
      [],
      colorById
    )
    expect(buildReservaBanner(summary, 'NO-EXISTE')).toBeNull()
  })
})
