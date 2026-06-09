import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  reporteStock,
  reporteMovimientos,
  reporteDiferencias,
  reporteAntiguedad,
  reporteMerma,
  reporteTintorerias,
  reporteStockPorCombo,
  reporteCobertura,
  reporteRotacionABC,
  reporteRollosViejos,
  reporteDemandaActiva,
  reporteRankingClientes,
  reportePedidosCancelados,
  reporteTintoreriaPerformance,
  reporteMuestras,
  reporteDiferenciaGramaje,
  reporteMermaPartida,
  reporteTendenciaMensual,
  reporteActividadUsuarios,
  type ReportesFilters,
} from '../queries'

const TIPOS = [
  'stock',
  'movimientos',
  'diferencias',
  'antiguedad',
  'merma',
  'tintorerias',
  'stock-combo',
  'cobertura',
  'abc',
  'viejos',
  'demanda',
  'ranking',
  'cancelados',
  'scorecard',
  'muestras',
  'gramaje',
  'merma-partida',
  'tendencia',
  'actividad',
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
    desde: url.searchParams.get('desde') ?? undefined,
    hasta: url.searchParams.get('hasta') ?? undefined,
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
        ['Pedidos egresados', m.mes, m.pedidosEntregados, ''],
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
        'Egresados',
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
  } else if (tipo === 'stock-combo') {
    const data = await reporteStockPorCombo(supabase, filters)
    csv = toCSV(
      ['Artículo', 'Color', 'Rollos', 'Kilos', 'Stock mínimo', 'Bajo mínimo'],
      data.map((r) => [
        r.articulo,
        r.color,
        r.rollos,
        r.kilos.toFixed(2),
        r.stockMinimo != null ? r.stockMinimo.toFixed(2) : '',
        r.bajoMinimo ? 'Sí' : 'No',
      ])
    )
    filename = 'reporte-stock-por-articulo-color.csv'
  } else if (tipo === 'cobertura') {
    const data = await reporteCobertura(supabase, filters)
    const semaforoLabel: Record<string, string> = {
      critico: 'Riesgo quiebre',
      ok: 'Saludable',
      alto: 'Alto',
      sobrestock: 'Sobrestock',
      sin_dato: 'Sin ventas',
    }
    csv = toCSV(
      [
        'Artículo',
        'Kg en stock',
        'Kg vendidos 60d',
        'Venta diaria',
        'Días de cobertura',
        'Estado',
      ],
      data.map((r) => [
        r.articulo,
        r.kilosEnStock.toFixed(2),
        r.kilosVendidos60d.toFixed(2),
        r.ventaDiaria.toFixed(2),
        r.diasCobertura != null ? Math.round(r.diasCobertura) : '',
        semaforoLabel[r.semaforo] ?? r.semaforo,
      ])
    )
    filename = 'reporte-cobertura.csv'
  } else if (tipo === 'abc') {
    const data = await reporteRotacionABC(supabase, filters)
    csv = toCSV(
      ['Artículo', 'Kg vendidos', '% acumulado', 'Clase'],
      data.map((r) => [
        r.articulo,
        r.kilosVendidos.toFixed(2),
        r.pctAcumulado.toFixed(1),
        r.clase,
      ])
    )
    filename = 'reporte-rotacion-abc.csv'
  } else if (tipo === 'viejos') {
    const data = await reporteRollosViejos(supabase, filters, 100)
    csv = toCSV(
      ['Pieza', 'Artículo', 'Color', 'Ubicación', 'Kilos', 'Días en stock'],
      data.map((r) => [
        r.numero_pieza,
        r.articulo,
        r.color,
        r.ubicacion,
        r.kilos.toFixed(2),
        r.dias,
      ])
    )
    filename = 'reporte-rollos-viejos.csv'
  } else if (tipo === 'demanda') {
    const data = await reporteDemandaActiva(supabase, filters)
    csv = toCSV(
      [
        'Cliente',
        'Artículo',
        'Color',
        'Kg estimados',
        'Metros estimados',
        'Prioridad',
        'Fecha requerida',
        'Días esperando',
      ],
      data.map((r) => [
        r.cliente,
        r.articulo,
        r.color,
        r.kilos.toFixed(2),
        r.metros.toFixed(2),
        r.prioridad,
        r.fechaRequerida
          ? new Date(r.fechaRequerida).toLocaleDateString('es-AR')
          : '',
        r.dias,
      ])
    )
    filename = 'reporte-demanda-pendiente.csv'
  } else if (tipo === 'ranking') {
    const data = await reporteRankingClientes(supabase, filters)
    csv = toCSV(
      ['Cliente', 'Pedidos', 'Kilos', 'Ticket promedio (kg)'],
      data.map((r) => [
        r.cliente,
        r.pedidos,
        r.kilos.toFixed(2),
        r.ticketPromedio.toFixed(2),
      ])
    )
    filename = 'reporte-ranking-clientes.csv'
  } else if (tipo === 'cancelados') {
    const data = await reportePedidosCancelados(supabase, filters)
    csv = toCSV(
      ['Pedido', 'Cliente', 'Motivo', 'Kg liberados', 'Fecha'],
      data.lista.map((r) => [
        r.numero_pedido,
        r.cliente,
        r.motivo,
        r.kilos.toFixed(2),
        new Date(r.fecha).toLocaleDateString('es-AR'),
      ])
    )
    filename = 'reporte-pedidos-caidos.csv'
  } else if (tipo === 'scorecard') {
    const { scorecard } = await reporteTintoreriaPerformance(supabase, filters)
    csv = toCSV(
      [
        'Tintorería',
        'Rollos recibidos',
        'Rinde (m/kg)',
        'Rollos segunda',
        'Tasa fallas %',
        'Rollos medidos',
        'Dif. declarado vs propio (kg)',
        'Dif. %',
        'Tiempo ciclo (días)',
      ],
      scorecard.map((r) => [
        r.tintoreria,
        r.rollosRecibidos,
        r.rindePonderado != null ? r.rindePonderado.toFixed(2) : '',
        r.rollosSegunda,
        r.tasaFallasPct.toFixed(1),
        r.rollosMedidos,
        r.difKg != null ? r.difKg.toFixed(2) : '',
        r.difPct != null ? r.difPct.toFixed(1) : '',
        r.tiempoCicloDias != null ? r.tiempoCicloDias.toFixed(1) : '',
      ])
    )
    filename = 'reporte-scorecard-tintorerias.csv'
  } else if (tipo === 'muestras') {
    const data = await reporteMuestras(supabase, filters)
    csv = toCSV(
      ['Cliente', 'Muestras', 'Kilos'],
      data.topClientes.map((r) => [r.cliente, r.muestras, r.kilos.toFixed(2)])
    )
    filename = 'reporte-muestras.csv'
  } else if (tipo === 'gramaje') {
    const data = await reporteDiferenciaGramaje(supabase, filters)
    csv = toCSV(
      [
        'Tintorería',
        'Artículo',
        'Color',
        'Rollos',
        'Gramaje planilla',
        'Gramaje propio',
        'Diferencia promedio',
      ],
      data.map((r) => [
        r.tintoreria,
        r.articulo,
        r.color,
        r.rollos,
        r.gramajePlanilla.toFixed(1),
        r.gramajePropio.toFixed(1),
        r.difPromedio.toFixed(1),
      ])
    )
    filename = 'reporte-diferencia-gramaje.csv'
  } else if (tipo === 'merma-partida') {
    const data = await reporteMermaPartida(supabase, filters)
    csv = toCSV(
      ['Partida', 'Tintorería', 'Fecha', 'Crudo kg', 'Teñido kg', 'Merma kg', 'Merma %'],
      data.partidas.map((r) => [
        r.partida,
        r.tintoreria,
        new Date(r.fecha).toLocaleDateString('es-AR'),
        r.crudo.toFixed(2),
        r.tenido.toFixed(2),
        r.mermaKg.toFixed(2),
        r.mermaPct.toFixed(1),
      ])
    )
    filename = 'reporte-merma-por-partida.csv'
  } else if (tipo === 'tendencia') {
    const data = await reporteTendenciaMensual(supabase, filters)
    csv = toCSV(
      ['Mes', 'Ingresados kg', 'Egresados kg', 'Neto acumulado kg'],
      data.map((r) => [
        r.label,
        r.ingresadosKg.toFixed(2),
        r.egresadosKg.toFixed(2),
        r.netoAcumKg.toFixed(2),
      ])
    )
    filename = 'reporte-tendencia-mensual.csv'
  } else if (tipo === 'actividad') {
    const data = await reporteActividadUsuarios(supabase, filters)
    csv = toCSV(
      ['Usuario', 'Cargados', 'Confirmados', 'Pickeados'],
      data.map((r) => [r.usuario, r.cargados, r.confirmados, r.pickeados])
    )
    filename = 'reporte-actividad-usuarios.csv'
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
