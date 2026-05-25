import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ReportesFilters = {
  /** ID de tintorería para filtrar rollos por origen (stock, merma, diferencias, antigüedad). */
  tintoreriaId?: string
  tintoreriaIds?: string[]
  /** ID de artículo. */
  articuloId?: string
  articuloIds?: string[]
  /** Año en formato 4 dígitos. Solo aplica a Movimientos. */
  anio?: number
  /** Mes 1-12. Solo aplica a Movimientos. Si se omite y hay año → todo el año. */
  mes?: number
  meses?: number[]
}

function listOrSingle(list?: string[], single?: string): string[] {
  return list?.length ? list : single ? [single] : []
}

function monthList(filters: ReportesFilters): number[] {
  if (filters.meses?.length) return filters.meses
  return filters.mes ? [filters.mes] : []
}

function rowMatchesMonths(createdAt: string, meses: number[]): boolean {
  if (meses.length === 0) return true
  return meses.includes(new Date(createdAt).getMonth() + 1)
}

// ── Stock por artículo+color ───────────────────────────────

export type StockRow = {
  articulo: string
  color: string
  rollos: number
  kilos: number
}

export async function reporteStock(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<StockRow[]> {
  let query = supabase
    .from('rollos')
    .select(
      'kilos, articulo_id, color, articulos!inner ( nombre ), ingresos!inner ( tintoreria_id )'
    )
    .eq('estado', 'en_stock')

  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1) {
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])
  }

  const { data } = await query

  type Raw = {
    kilos: number | null
    color: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  const map = new Map<string, StockRow>()
  for (const r of rows) {
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.color ?? '—'
    const key = `${articulo}|||${color}`
    const prev = map.get(key) ?? { articulo, color, rollos: 0, kilos: 0 }
    prev.rollos += 1
    prev.kilos += Number(r.kilos ?? 0)
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.kilos - a.kilos)
}

// ── Movimientos del mes/año ─────────────────────────────────

export type MovimientosResult = {
  mes: string
  ingresosRollos: number
  ingresosKilos: number
  egresosRollos: number
  egresosKilos: number
  pedidosEntregados: number
}

/** Devuelve el rango [desde, hasta) en ISO y un label legible. */
function rangoPeriodo(filters: ReportesFilters): {
  desde: string
  hasta: string
  label: string
} {
  const meses = monthList(filters).sort((a, b) => a - b)
  if (filters.anio && meses.length > 0) {
    const desde = new Date(filters.anio, meses[0] - 1, 1)
    const hasta = new Date(filters.anio, meses[meses.length - 1], 1)
    const label =
      meses.length === 1
        ? desde.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric',
          })
        : `${meses.length} meses de ${filters.anio}`
    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      label,
    }
  }
  if (filters.anio) {
    const desde = new Date(filters.anio, 0, 1)
    const hasta = new Date(filters.anio + 1, 0, 1)
    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      label: `año ${filters.anio}`,
    }
  }
  // Default: mes actual
  const inicio = new Date()
  inicio.setDate(1)
  inicio.setHours(0, 0, 0, 0)
  const finMes = new Date(inicio)
  finMes.setMonth(finMes.getMonth() + 1)
  return {
    desde: inicio.toISOString(),
    hasta: finMes.toISOString(),
    label: inicio.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    }),
  }
}

export async function reporteMovimientos(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<MovimientosResult> {
  const { desde, hasta, label } = rangoPeriodo(filters)
  const meses = monthList(filters)
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  // Ingresos: rollos creados en el período
  let qRollos = supabase
    .from('rollos')
    .select('kilos, articulo_id, created_at, ingresos!inner ( tintoreria_id )')
    .gte('created_at', desde)
    .lt('created_at', hasta)

  if (articuloIds.length > 1) qRollos = qRollos.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) qRollos = qRollos.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1) {
    qRollos = qRollos.in('ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    qRollos = qRollos.eq('ingresos.tintoreria_id', tintoreriaIds[0])
  }

  const { data: rollosMesRaw } = await qRollos
  const rollosMes = (rollosMesRaw ?? []).filter((r) =>
    rowMatchesMonths(r.created_at, meses)
  )

  const ingresosRollos = rollosMes.length
  const ingresosKilos = rollosMes.reduce(
    (acc, r) => acc + Number(r.kilos ?? 0),
    0
  )

  // Egresos: pedidos entregados en el período
  const { data: pedidosEntregadosRaw } = await supabase
    .from('pedidos')
    .select(`id, created_at, pedido_rollos ( rollos ( kilos, articulo_id, ingreso_id ) )`)
    .eq('estado', 'entregada')
    .gte('created_at', desde)
    .lt('created_at', hasta)

  type PedRaw = {
    id: string
    created_at: string
    pedido_rollos:
      | {
          rollos: {
            kilos: number | null
            articulo_id: string | null
            ingreso_id: string
          } | null
        }[]
      | null
  }
  const pedidos = ((pedidosEntregadosRaw ?? []) as unknown as PedRaw[]).filter(
    (p) => rowMatchesMonths(p.created_at, meses)
  )

  // Si hay filtros de articulo/tintoreria, los aplicamos en el lado client.
  // Para tintorería necesitamos lookup, lo hacemos abajo si hace falta.
  let tintoreriaRolloMap = new Map<string, string | null>()
  if (tintoreriaIds.length > 0) {
    const ingresoIds = new Set<string>()
    for (const p of pedidos)
      for (const pr of p.pedido_rollos ?? [])
        if (pr.rollos?.ingreso_id) ingresoIds.add(pr.rollos.ingreso_id)
    if (ingresoIds.size > 0) {
      const { data: ings } = await supabase
        .from('ingresos')
        .select('id, tintoreria_id')
        .in('id', [...ingresoIds])
      tintoreriaRolloMap = new Map(
        (ings ?? []).map((i) => [i.id, i.tintoreria_id])
      )
    }
  }

  let egresosRollos = 0
  let egresosKilos = 0
  let pedidosContados = 0
  for (const p of pedidos) {
    let pedidoTieneRolloMatch = false
    for (const pr of p.pedido_rollos ?? []) {
      const r = pr.rollos
      if (!r) continue
      if (
        articuloIds.length > 0 &&
        !articuloIds.includes(r.articulo_id ?? '')
      )
        continue
      if (
        tintoreriaIds.length > 0 &&
        !tintoreriaIds.includes(tintoreriaRolloMap.get(r.ingreso_id) ?? '')
      )
        continue
      egresosRollos += 1
      egresosKilos += Number(r.kilos ?? 0)
      pedidoTieneRolloMatch = true
    }
    if (pedidoTieneRolloMatch) pedidosContados += 1
  }

  return {
    mes: label,
    ingresosRollos,
    ingresosKilos,
    egresosRollos,
    egresosKilos,
    pedidosEntregados: pedidosContados,
  }
}

// ── Diferencias proveedor vs propio ────────────────────────

export type DiferenciaRow = {
  id: string
  numero_pieza: string
  articulo: string
  color: string
  kilos: number
  kilos_propios: number
  dif_kilos: number
}

export async function reporteDiferencias(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<DiferenciaRow[]> {
  let query = supabase
    .from('rollos')
    .select(
      `id, numero_pieza, kilos, kilos_propios, articulo_id, color,
       articulos ( nombre ),
       ingresos!inner ( tintoreria_id )`
    )
    .not('kilos_propios', 'is', null)
    .order('numero_pieza', { ascending: true })

  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1) {
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])
  }

  const { data } = await query

  type Raw = {
    id: string
    numero_pieza: string
    kilos: number | null
    kilos_propios: number | null
    color: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  return rows.map((r) => {
    const k = Number(r.kilos ?? 0)
    const kp = Number(r.kilos_propios ?? 0)
    return {
      id: r.id,
      numero_pieza: r.numero_pieza,
      articulo: r.articulos?.nombre ?? '—',
      color: r.color ?? '—',
      kilos: k,
      kilos_propios: kp,
      dif_kilos: kp - k,
    }
  })
}

// ── Merma (diferencia planilla vs propio) ──────────────────

export type MermaRow = {
  articulo: string
  color: string
  rollos_con_medicion: number
  kilos_planilla: number
  kilos_propios: number
  merma_kg: number
  merma_pct: number
}

export type MermaResult = {
  rows: MermaRow[]
  total_kilos_planilla: number
  total_kilos_propios: number
  total_merma_kg: number
  total_merma_pct: number
}

export async function reporteMerma(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<MermaResult> {
  let query = supabase
    .from('rollos')
    .select(
      `kilos, kilos_propios, articulo_id, color, articulos ( nombre ), ingresos!inner ( tintoreria_id )`
    )
    .not('kilos_propios', 'is', null)
    .not('kilos', 'is', null)

  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1) {
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])
  }

  const { data } = await query

  type Raw = {
    kilos: number | null
    kilos_propios: number | null
    color: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  const map = new Map<string, MermaRow>()
  for (const r of rows) {
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.color ?? '—'
    const key = `${articulo}|||${color}`
    const prev = map.get(key) ?? {
      articulo,
      color,
      rollos_con_medicion: 0,
      kilos_planilla: 0,
      kilos_propios: 0,
      merma_kg: 0,
      merma_pct: 0,
    }
    const kPlanilla = Number(r.kilos ?? 0)
    const kPropios = Number(r.kilos_propios ?? 0)
    prev.rollos_con_medicion += 1
    prev.kilos_planilla += kPlanilla
    prev.kilos_propios += kPropios
    prev.merma_kg += Math.max(0, kPlanilla - kPropios)
    map.set(key, prev)
  }

  const result: MermaRow[] = []
  for (const row of map.values()) {
    row.merma_pct =
      row.kilos_planilla > 0 ? (row.merma_kg / row.kilos_planilla) * 100 : 0
    result.push(row)
  }
  result.sort((a, b) => b.merma_kg - a.merma_kg)

  const total_kilos_planilla = result.reduce((s, r) => s + r.kilos_planilla, 0)
  const total_kilos_propios = result.reduce((s, r) => s + r.kilos_propios, 0)
  const total_merma_kg = result.reduce((s, r) => s + r.merma_kg, 0)
  const total_merma_pct =
    total_kilos_planilla > 0
      ? (total_merma_kg / total_kilos_planilla) * 100
      : 0

  return {
    rows: result,
    total_kilos_planilla,
    total_kilos_propios,
    total_merma_kg,
    total_merma_pct,
  }
}

// ── Pedidos por tintorería ──────────────────────────────────
// Cruza pedido_rollos → rollos → ingresos → tintorerias para
// medir qué tintorerías están atrás de los pedidos. Útil para
// análisis de origen de la mercadería vendida.

export type PedidosTintoreriaRow = {
  tintoreria_id: string | null
  tintoreria: string
  pedidos: number          // pedidos distintos con al menos un rollo de esta tintorería
  rollos: number           // rollos totales originados acá
  kilos: number            // suma de kilos
  entregados: number       // pedidos en estado entregada
  cancelados: number       // pedidos en estado cancelada
  en_curso: number         // pedidos en estados intermedios
}

export async function reporteTintorerias(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<PedidosTintoreriaRow[]> {
  // Sin filtro de período → todo el histórico. Con filtros → el rango.
  const aplicarPeriodo = filters.anio !== undefined
  const { desde, hasta } = aplicarPeriodo
    ? (() => {
        const r = (function () {
          const mesesPeriodo = monthList(filters).sort((a, b) => a - b)
          if (filters.anio && mesesPeriodo.length > 0) {
            return {
              desde: new Date(filters.anio, mesesPeriodo[0] - 1, 1),
              hasta: new Date(filters.anio, mesesPeriodo[mesesPeriodo.length - 1], 1),
            }
          }
          if (filters.anio) {
            return {
              desde: new Date(filters.anio, 0, 1),
              hasta: new Date(filters.anio + 1, 0, 1),
            }
          }
          return null
        })()
        return r
          ? { desde: r.desde.toISOString(), hasta: r.hasta.toISOString() }
          : { desde: '', hasta: '' }
      })()
    : { desde: '', hasta: '' }

  let query = supabase
    .from('pedido_rollos')
    .select(
      `
        rollos!inner (
          id,
          kilos,
          articulo_id,
          ingresos!inner (
            id,
            tintoreria_id,
            tintorerias ( id, nombre )
          )
        ),
        pedidos!inner ( id, estado, created_at )
      `
    )
    .limit(5000)

  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)
  const meses = monthList(filters)
  if (articuloIds.length > 1) {
    query = query.in('rollos.articulo_id', articuloIds)
  } else if (articuloIds.length === 1) {
    query = query.eq('rollos.articulo_id', articuloIds[0])
  }
  if (tintoreriaIds.length > 1) {
    query = query.in('rollos.ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    query = query.eq('rollos.ingresos.tintoreria_id', tintoreriaIds[0])
  }
  if (aplicarPeriodo && desde && hasta) {
    query = query.gte('pedidos.created_at', desde).lt('pedidos.created_at', hasta)
  }

  const { data } = await query

  type Raw = {
    rollos: {
      kilos: number | null
      ingresos: {
        tintoreria_id: string | null
        tintorerias: { id: string; nombre: string } | null
      } | null
    } | null
    pedidos: {
      id: string
      estado: string
      created_at: string
    } | null
  }
  const rows = ((data ?? []) as unknown as Raw[]).filter((r) =>
    r.pedidos ? rowMatchesMonths(r.pedidos.created_at, meses) : true
  )

  // Agregar por tintoreria_id. Para contar pedidos distintos, llevamos
  // un Set de IDs por tintorería.
  const map = new Map<
    string,
    {
      tintoreria_id: string | null
      tintoreria: string
      pedidoIds: Set<string>
      pedidoEstados: Map<string, string>
      rollos: number
      kilos: number
    }
  >()

  for (const r of rows) {
    if (!r.rollos || !r.pedidos) continue
    const ting = r.rollos.ingresos?.tintorerias
    const key = ting?.id ?? 'sin'
    const acc = map.get(key) ?? {
      tintoreria_id: ting?.id ?? null,
      tintoreria: ting?.nombre ?? 'Sin tintorería',
      pedidoIds: new Set<string>(),
      pedidoEstados: new Map<string, string>(),
      rollos: 0,
      kilos: 0,
    }
    acc.pedidoIds.add(r.pedidos.id)
    acc.pedidoEstados.set(r.pedidos.id, r.pedidos.estado)
    acc.rollos += 1
    acc.kilos += Number(r.rollos.kilos ?? 0)
    map.set(key, acc)
  }

  const result: PedidosTintoreriaRow[] = []
  for (const v of map.values()) {
    let entregados = 0
    let cancelados = 0
    let en_curso = 0
    for (const estado of v.pedidoEstados.values()) {
      if (estado === 'entregada') entregados += 1
      else if (estado === 'cancelada') cancelados += 1
      else en_curso += 1
    }
    result.push({
      tintoreria_id: v.tintoreria_id,
      tintoreria: v.tintoreria,
      pedidos: v.pedidoIds.size,
      rollos: v.rollos,
      kilos: v.kilos,
      entregados,
      cancelados,
      en_curso,
    })
  }
  result.sort((a, b) => b.kilos - a.kilos)
  return result
}

// ── Antigüedad de stock ─────────────────────────────────────

export type AntiguedadRow = {
  id: string
  numero_pieza: string
  articulo: string
  color: string
  ubicacion: string
  kilos: number
  created_at: string
  dias: number
}

export async function reporteAntiguedad(
  supabase: SupabaseClient,
  dias: number,
  filters: ReportesFilters = {}
): Promise<AntiguedadRow[]> {
  const limite = new Date()
  limite.setDate(limite.getDate() - dias)
  const limiteIso = limite.toISOString()

  let query = supabase
    .from('rollos')
    .select(
      `id, numero_pieza, ubicacion, kilos, created_at, articulo_id, color,
       articulos ( nombre ),
       ingresos!inner ( tintoreria_id )`
    )
    .eq('estado', 'en_stock')
    .lt('created_at', limiteIso)
    .order('created_at', { ascending: true })

  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1) {
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  } else if (tintoreriaIds.length === 1) {
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])
  }

  const { data } = await query

  type Raw = {
    id: string
    numero_pieza: string
    ubicacion: string | null
    kilos: number | null
    created_at: string
    color: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]
  const ahora = Date.now()

  return rows.map((r) => {
    const created = new Date(r.created_at).getTime()
    const diasReales = Math.floor((ahora - created) / (1000 * 60 * 60 * 24))
    return {
      id: r.id,
      numero_pieza: r.numero_pieza,
      articulo: r.articulos?.nombre ?? '—',
      color: r.color ?? '—',
      ubicacion: r.ubicacion ?? '—',
      kilos: Number(r.kilos ?? 0),
      created_at: r.created_at,
      dias: diasReales,
    }
  })
}
