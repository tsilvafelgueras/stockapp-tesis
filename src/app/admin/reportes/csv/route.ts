import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  reporteStock,
  reporteMovimientos,
  reporteDiferencias,
  reporteAntiguedad,
  reporteMerma,
  reporteTintorerias,
  type ReportesFilters,
} from '../queries'

const TIPOS = [
  'stock',
  'movimientos',
  'diferencias',
  'antiguedad',
  'merma',
  'tintorerias',
] as const
type Tipo = (typeof TIPOS)[number]

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const head = headers.map(csvCell).join(',')
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  return '﻿' + head + '\n' + body
}

function parseFilters(url: URL): ReportesFilters {
  const split = (key: string) =>
    url.searchParams.get(key)?.split(',').map((v) => v.trim()).filter(Boolean) ??
    []
  const meses = split('mes')
    .map(Number)
    .filter((n) => n >= 1 && n <= 12)
  return {
    tintoreriaIds: split('tintoreria'),
    articuloIds: split('articulo'),
    anio: url.searchParams.get('anio')
      ? Number(url.searchParams.get('anio'))
      : undefined,
    meses,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('No autorizado.', { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return new NextResponse('Solo el admin puede exportar reportes.', {
      status: 403,
    })
  }

  const url = new URL(request.url)
  const tipo = url.searchParams.get('tipo') as Tipo | null
  if (!tipo || !TIPOS.includes(tipo)) {
    return new NextResponse('Tipo de reporte inválido.', { status: 400 })
  }

  const filters = parseFilters(url)

  let csv = ''
  let filename = ''

  if (tipo === 'stock') {
    const data = await reporteStock(supabase, filters)
    csv = toCSV(
      ['Artículo', 'Color', 'Rollos', 'Kilos'],
      data.map((r) => [r.articulo, r.color, r.rollos, r.kilos.toFixed(2)])
    )
    filename = 'reporte-stock.csv'
  } else if (tipo === 'movimientos') {
    const m = await reporteMovimientos(supabase, filters)
    csv = toCSV(
      ['Concepto', 'Período', 'Rollos', 'Kilos'],
      [
        ['Ingresos', m.mes, m.ingresosRollos, m.ingresosKilos.toFixed(2)],
        ['Egresos', m.mes, m.egresosRollos, m.egresosKilos.toFixed(2)],
        ['Pedidos entregados', m.mes, m.pedidosEntregados, ''],
      ]
    )
    filename = 'reporte-movimientos.csv'
  } else if (tipo === 'diferencias') {
    const data = await reporteDiferencias(supabase, filters)
    csv = toCSV(
      [
        'Pieza',
        'Artículo',
        'Color',
        'Kg planilla',
        'Kg propios',
        'Diferencia kg',
      ],
      data.map((r) => [
        r.numero_pieza,
        r.articulo,
        r.color,
        r.kilos.toFixed(2),
        r.kilos_propios.toFixed(2),
        r.dif_kilos.toFixed(2),
      ])
    )
    filename = 'reporte-diferencias.csv'
  } else if (tipo === 'tintorerias') {
    const data = await reporteTintorerias(supabase, filters)
    csv = toCSV(
      [
        'Tintorería',
        'Pedidos',
        'Entregados',
        'En curso',
        'Cancelados',
        'Rollos',
        'Kilos',
      ],
      data.map((r) => [
        r.tintoreria,
        r.pedidos,
        r.entregados,
        r.en_curso,
        r.cancelados,
        r.rollos,
        r.kilos.toFixed(2),
      ])
    )
    filename = 'reporte-pedidos-por-tintoreria.csv'
  } else if (tipo === 'merma') {
    const data = await reporteMerma(supabase, filters)
    csv = toCSV(
      [
        'Artículo',
        'Color',
        'Rollos medidos',
        'Kg planilla',
        'Kg propios',
        'Merma kg',
        'Merma %',
      ],
      data.rows.map((r) => [
        r.articulo,
        r.color,
        r.rollos_con_medicion,
        r.kilos_planilla.toFixed(2),
        r.kilos_propios.toFixed(2),
        r.merma_kg.toFixed(2),
        r.merma_pct.toFixed(2),
      ])
    )
    filename = 'reporte-merma.csv'
  } else {
    // antiguedad
    const dias = Number(url.searchParams.get('dias')) > 0
      ? Number(url.searchParams.get('dias'))
      : 30
    const data = await reporteAntiguedad(supabase, dias, filters)
    csv = toCSV(
      [
        'Pieza',
        'Artículo',
        'Color',
        'Ubicación',
        'Ingresó',
        'Kilos',
        'Días en mano',
      ],
      data.map((r) => [
        r.numero_pieza,
        r.articulo,
        r.color,
        r.ubicacion,
        new Date(r.created_at).toLocaleDateString('es-AR'),
        r.kilos.toFixed(2),
        r.dias,
      ])
    )
    filename = `reporte-dias-en-mano-${dias}d.csv`
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
