import { describe, expect, it } from 'vitest'
import { agruparArticulosSinAsignar } from './articulosPendientes'

describe('artículos nuevos leídos de planilla', () => {
  it('agrupa los 16 rollos en dos solicitudes, conservando el resto del ingreso', () => {
    const rollos = [
      ...Array.from({ length: 10 }, () => ({ articulo_nombre_sugerido: 'VAPLEX FRISADO TERMINADO' })),
      ...Array.from({ length: 6 }, () => ({ articulo_nombre_sugerido: 'CATION PLUS FRISADO TERMINADO' })),
      { articulo_nombre_sugerido: 'ML70', articulo_id: 'existente' },
      {},
    ]
    expect(agruparArticulosSinAsignar(rollos)).toEqual([
      { clave: 'vaplex frisado terminado', nombre: 'VAPLEX FRISADO TERMINADO', cantidad: 10 },
      { clave: 'cation plus frisado terminado', nombre: 'CATION PLUS FRISADO TERMINADO', cantidad: 6 },
    ])
  })
  it('no duplica solicitudes por casing/espacios ni propone crear nombres vacíos', () => {
    expect(agruparArticulosSinAsignar([
      { articulo_nombre_sugerido: ' Vaplex  Frisado ' },
      { articulo_nombre_sugerido: 'VAPLEX FRISADO' },
      { articulo_nombre_sugerido: '   ' },
    ])).toEqual([{ clave: 'vaplex frisado', nombre: 'Vaplex Frisado', cantidad: 2 }])
  })
})
