import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  reporteStock,
  reporteMovimientos,
  reporteDiferencias,
  reporteAntiguedad,
} from '../queries'

const TIPOS = ['stock', 'movimientos', 'diferencias', 'antiguedad'] as const
type Tipo = (typeof TIPOS)[number]

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  // Si tiene coma, comilla o salto de línea, encerramos en comillas y escapamos.
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const head = headers.map(csvCell).join(',')
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  // BOM para que Excel reconozca UTF-8 con tildes
  return '﻿' + head + '\n' + body
}

export async function GET(request: Request) {
  const supabase = await createClient()

  // Sólo admin (y la layout de /admin ya hace el guard de rol; igual reforzamos).
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

  let csv = ''
  let filename = ''

  if (tipo === 'stock') {
    const data = await reporteStock(supabase)
    csv = toCSV(
      ['Artículo', 'Color', 'Rollos', 'Kilos'],
      data.map((r) => [r.articulo, r.color, r.rollos, r.kilos.toFixed(2)])
    )
    filename = 'reporte-stock.csv'
  } else if (tipo === 'movimientos') {
    const m = await reporteMovimientos(supabase)
    csv = toCSV(
      ['Concepto', 'Mes', 'Rollos', 'Kilos'],
      [
        ['Ingresos', m.mes, m.ingresosRollos, m.ingresosKilos.toFixed(2)],
        ['Egresos', m.mes, m.egresosRollos, m.egresosKilos.toFixed(2)],
        [
          'Pedidos entregados',
          m.mes,
          m.pedidosEntregados,
          '',
        ],
      ]
    )
    filename = 'reporte-movimientos.csv'
  } else if (tipo === 'diferencias') {
    const data = await reporteDiferencias(supabase)
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
  } else {
    // antiguedad
    const dias = Number(url.searchParams.get('dias')) > 0
      ? Number(url.searchParams.get('dias'))
      : 30
    const data = await reporteAntiguedad(supabase, dias)
    csv = toCSV(
      [
        'Pieza',
        'Artículo',
        'Color',
        'Ubicación',
        'Ingresó',
        'Kilos',
        'Días',
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
    filename = `reporte-antiguedad-${dias}d.csv`
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
