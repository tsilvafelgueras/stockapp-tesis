import { describe, it, expect } from 'vitest'
import { fechaEnRango, normalizarFechaISO } from './fechas'

describe('normalizarFechaISO', () => {
  it('deja igual una fecha ya en ISO', () => {
    expect(normalizarFechaISO('2026-05-03')).toBe('2026-05-03')
  })

  it('recorta la hora de un timestamp ISO', () => {
    expect(normalizarFechaISO('2026-05-03T14:25:00Z')).toBe('2026-05-03')
  })

  it('convierte formato argentino DD/MM/YYYY', () => {
    expect(normalizarFechaISO('03/05/2026')).toBe('2026-05-03')
  })

  it('convierte año de 2 dígitos a 20YY', () => {
    expect(normalizarFechaISO('3/5/26')).toBe('2026-05-03')
  })

  it('devuelve null para vacío o formato desconocido', () => {
    expect(normalizarFechaISO('')).toBeNull()
    expect(normalizarFechaISO(null)).toBeNull()
    expect(normalizarFechaISO(undefined)).toBeNull()
    expect(normalizarFechaISO('mayo de 2026')).toBeNull()
  })
})

describe('fechaEnRango', () => {
  it('sin desde ni hasta no filtra: todo pasa', () => {
    expect(fechaEnRango('2026-05-03', '', '')).toBe(true)
    // incluso una fecha vacía pasa cuando no hay rango activo
    expect(fechaEnRango(null, '', '')).toBe(true)
  })

  it('filtra por límite inferior (solo desde, inclusive)', () => {
    expect(fechaEnRango('2026-05-10', '2026-05-10', '')).toBe(true) // inclusive
    expect(fechaEnRango('2026-05-11', '2026-05-10', '')).toBe(true)
    expect(fechaEnRango('2026-05-09', '2026-05-10', '')).toBe(false)
  })

  it('filtra por límite superior (solo hasta, inclusive)', () => {
    expect(fechaEnRango('2026-05-10', '', '2026-05-10')).toBe(true) // inclusive
    expect(fechaEnRango('2026-05-09', '', '2026-05-10')).toBe(true)
    expect(fechaEnRango('2026-05-11', '', '2026-05-10')).toBe(false)
  })

  it('filtra por rango completo [desde, hasta]', () => {
    expect(fechaEnRango('2026-05-05', '2026-05-01', '2026-05-10')).toBe(true)
    expect(fechaEnRango('2026-05-01', '2026-05-01', '2026-05-10')).toBe(true)
    expect(fechaEnRango('2026-05-10', '2026-05-01', '2026-05-10')).toBe(true)
    expect(fechaEnRango('2026-04-30', '2026-05-01', '2026-05-10')).toBe(false)
    expect(fechaEnRango('2026-05-11', '2026-05-01', '2026-05-10')).toBe(false)
  })

  it('fecha puntual: desde === hasta matchea solo ese día', () => {
    expect(fechaEnRango('2026-05-03', '2026-05-03', '2026-05-03')).toBe(true)
    expect(fechaEnRango('2026-05-04', '2026-05-03', '2026-05-03')).toBe(false)
    expect(fechaEnRango('2026-05-02', '2026-05-03', '2026-05-03')).toBe(false)
  })

  it('cruza años y meses correctamente (comparación cronológica)', () => {
    expect(fechaEnRango('2025-12-31', '2025-12-01', '2026-01-31')).toBe(true)
    expect(fechaEnRango('2026-01-15', '2025-12-01', '2026-01-31')).toBe(true)
    expect(fechaEnRango('2026-02-01', '2025-12-01', '2026-01-31')).toBe(false)
  })

  it('normaliza la fecha del registro antes de comparar (tolera formato argentino)', () => {
    expect(fechaEnRango('03/05/2026', '2026-05-01', '2026-05-10')).toBe(true)
    expect(fechaEnRango('2026-05-03T09:00:00Z', '2026-05-03', '2026-05-03')).toBe(true)
  })

  it('un registro sin fecha queda fuera cuando hay un rango activo', () => {
    expect(fechaEnRango(null, '2026-05-01', '')).toBe(false)
    expect(fechaEnRango('', '', '2026-05-10')).toBe(false)
    expect(fechaEnRango(undefined, '2026-05-01', '2026-05-10')).toBe(false)
  })
})
