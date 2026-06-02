import {
  type ReportesFilters,
  type SupabaseClient,
  colorNameById,
  listOrSingle,
  rangoPeriodo,
} from './_shared'

// ════════════════════════════════════════════════════════════
//  BLOQUE A — Stock y rotación
//  "¿Qué tengo y qué tan rápido se mueve?"
// ════════════════════════════════════════════════════════════

// ── KPIs de stock ───────────────────────────────────────────

export type StockKpis = {
  kilosEnStock: number
  rollosEnStock: number
  combosBajoMinimo: number // combinaciones artículo+color por debajo de su mínimo
  rollosSegunda: number
}

export async function reporteStockKpis(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<StockKpis> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  // Rollos en stock (snapshot actual, no depende del período).
  let qStock = supabase
    .from('rollos')
    .select('kilos, articulo_id, color_id, ingresos!inner ( tintoreria_id )')
    .eq('estado', 'en_stock')
  if (articuloIds.length > 1) qStock = qStock.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) qStock = qStock.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    qStock = qStock.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    qStock = qStock.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  // Rollos en segunda calidad (snapshot actual).
  let qSegunda = supabase
    .from('rollos')
    .select('id, articulo_id, ingresos!inner ( tintoreria_id )', {
      count: 'exact',
      head: true,
    })
    .eq('estado', 'segunda')
  if (articuloIds.length > 1) qSegunda = qSegunda.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1)
    qSegunda = qSegunda.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    qSegunda = qSegunda.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    qSegunda = qSegunda.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  // Mínimos configurados por artículo+color (post-042: el mínimo vive en
  // articulo_colores, no en articulos).
  let qMin = supabase
    .from('articulo_colores')
    .select('articulo_id, color_id, stock_minimo_kg')
    .not('stock_minimo_kg', 'is', null)
  if (articuloIds.length > 1) qMin = qMin.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) qMin = qMin.eq('articulo_id', articuloIds[0])

  const [{ data: stockRows }, { count: rollosSegunda }, { data: minimos }] =
    await Promise.all([qStock, qSegunda, qMin])

  type StockRaw = { kilos: number | null; articulo_id: string; color_id: string }
  const rows = (stockRows ?? []) as unknown as StockRaw[]

  let kilosEnStock = 0
  const kgPorCombo = new Map<string, number>()
  for (const r of rows) {
    const k = Number(r.kilos ?? 0)
    kilosEnStock += k
    const key = `${r.articulo_id}|${r.color_id}`
    kgPorCombo.set(key, (kgPorCombo.get(key) ?? 0) + k)
  }

  let combosBajoMinimo = 0
  for (const m of minimos ?? []) {
    const actual = kgPorCombo.get(`${m.articulo_id}|${m.color_id}`) ?? 0
    if (actual < Number(m.stock_minimo_kg)) combosBajoMinimo += 1
  }

  return {
    kilosEnStock,
    rollosEnStock: rows.length,
    combosBajoMinimo,
    rollosSegunda: rollosSegunda ?? 0,
  }
}

// ── Stock por artículo + color (con flag de bajo mínimo) ────

export type StockComboRow = {
  articulo: string
  color: string
  articulo_id: string
  color_id: string
  rollos: number
  kilos: number
  stockMinimo: number | null
  bajoMinimo: boolean
}

export async function reporteStockPorCombo(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<StockComboRow[]> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  let query = supabase
    .from('rollos')
    .select(
      'kilos, articulo_id, color_id, articulos!inner ( nombre ), ingresos!inner ( tintoreria_id )'
    )
    .eq('estado', 'en_stock')
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  const [{ data }, colorById, { data: minimos }] = await Promise.all([
    query,
    colorNameById(supabase),
    supabase
      .from('articulo_colores')
      .select('articulo_id, color_id, stock_minimo_kg')
      .not('stock_minimo_kg', 'is', null),
  ])

  const minimoPorCombo = new Map<string, number>()
  for (const m of minimos ?? [])
    minimoPorCombo.set(
      `${m.articulo_id}|${m.color_id}`,
      Number(m.stock_minimo_kg)
    )

  type Raw = {
    kilos: number | null
    articulo_id: string
    color_id: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  const map = new Map<string, StockComboRow>()
  for (const r of rows) {
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.color_id ? colorById.get(r.color_id) ?? '—' : '—'
    const key = `${r.articulo_id}|${r.color_id}`
    const prev =
      map.get(key) ??
      ({
        articulo,
        color,
        articulo_id: r.articulo_id,
        color_id: r.color_id ?? '',
        rollos: 0,
        kilos: 0,
        stockMinimo: minimoPorCombo.get(key) ?? null,
        bajoMinimo: false,
      } as StockComboRow)
    prev.rollos += 1
    prev.kilos += Number(r.kilos ?? 0)
    map.set(key, prev)
  }

  const result = [...map.values()]
  for (const row of result) {
    row.bajoMinimo =
      row.stockMinimo != null && row.kilos < row.stockMinimo
  }
  return result.sort((a, b) => b.kilos - a.kilos)
}

// ── Helper interno: kilos vendidos por artículo en una ventana ──
//
// "Vendido" = rollos cuyo pedido está en estado 'entregada' dentro de la
// ventana [desde, hasta). Cruza pedido_rollos → rollos → pedidos.
//
// ⚠ PROXY DE FECHA: usamos `pedidos.confirmada_egreso_at` (cuándo egresó del
// depósito) y caemos a `pedidos.created_at` si está NULL. No tenemos un
// timestamp de "entrega" real por rollo; esto es lo más fiel disponible.
async function kilosVendidosPorArticulo(
  supabase: SupabaseClient,
  desdeMs: number,
  hastaMs: number,
  filters: ReportesFilters
): Promise<Map<string, number>> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  const { data } = await supabase
    .from('pedidos')
    .select(
      `id, created_at, confirmada_egreso_at,
       pedido_rollos ( rollos ( kilos, articulo_id, ingreso_id ) )`
    )
    .eq('estado', 'entregada')
    .limit(5000)

  type PedRaw = {
    created_at: string
    confirmada_egreso_at: string | null
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
  const pedidos = (data ?? []) as unknown as PedRaw[]

  // Lookup ingreso → tintoreria solo si filtramos por tintorería.
  let tintoreriaPorIngreso = new Map<string, string | null>()
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
      tintoreriaPorIngreso = new Map(
        (ings ?? []).map((i) => [i.id, i.tintoreria_id])
      )
    }
  }

  const porArticulo = new Map<string, number>()
  for (const p of pedidos) {
    const fecha = new Date(p.confirmada_egreso_at ?? p.created_at).getTime()
    if (fecha < desdeMs || fecha >= hastaMs) continue
    for (const pr of p.pedido_rollos ?? []) {
      const r = pr.rollos
      if (!r || !r.articulo_id) continue
      if (articuloIds.length > 0 && !articuloIds.includes(r.articulo_id)) continue
      if (
        tintoreriaIds.length > 0 &&
        !tintoreriaIds.includes(tintoreriaPorIngreso.get(r.ingreso_id) ?? '')
      )
        continue
      porArticulo.set(
        r.articulo_id,
        (porArticulo.get(r.articulo_id) ?? 0) + Number(r.kilos ?? 0)
      )
    }
  }
  return porArticulo
}

// ── Días de cobertura por artículo ──────────────────────────

export type CoberturaSemaforo =
  | 'sin_dato'
  | 'critico' // < 15 días → riesgo de quiebre
  | 'ok' // 15–45 días
  | 'alto' // 45–90 días
  | 'sobrestock' // > 90 días

export type CoberturaRow = {
  articulo: string
  articulo_id: string
  kilosEnStock: number
  kilosVendidos60d: number
  ventaDiaria: number
  diasCobertura: number | null
  semaforo: CoberturaSemaforo
}

export async function reporteCobertura(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<CoberturaRow[]> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  // Ventana fija de 60 días para la velocidad de venta (independiente del
  // filtro de período, que mueve otros reportes).
  const ahora = Date.now()
  const hace60 = ahora - 60 * 24 * 60 * 60 * 1000

  // Stock actual por artículo.
  let qStock = supabase
    .from('rollos')
    .select('kilos, articulo_id, articulos!inner ( nombre ), ingresos!inner ( tintoreria_id )')
    .eq('estado', 'en_stock')
  if (articuloIds.length > 1) qStock = qStock.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) qStock = qStock.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    qStock = qStock.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    qStock = qStock.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  const [{ data: stockData }, vendidos] = await Promise.all([
    qStock,
    kilosVendidosPorArticulo(supabase, hace60, ahora, filters),
  ])

  type Raw = {
    kilos: number | null
    articulo_id: string
    articulos: { nombre: string } | null
  }
  const rows = (stockData ?? []) as unknown as Raw[]

  const stockPorArticulo = new Map<string, { nombre: string; kilos: number }>()
  for (const r of rows) {
    const prev = stockPorArticulo.get(r.articulo_id) ?? {
      nombre: r.articulos?.nombre ?? '—',
      kilos: 0,
    }
    prev.kilos += Number(r.kilos ?? 0)
    stockPorArticulo.set(r.articulo_id, prev)
  }

  // Unimos artículos que tienen stock y/o ventas.
  const articuloIdsUnion = new Set<string>([
    ...stockPorArticulo.keys(),
    ...vendidos.keys(),
  ])

  const result: CoberturaRow[] = []
  for (const id of articuloIdsUnion) {
    const stock = stockPorArticulo.get(id)
    const kilosEnStock = stock?.kilos ?? 0
    const kilosVendidos60d = vendidos.get(id) ?? 0
    const ventaDiaria = kilosVendidos60d / 60
    const diasCobertura =
      ventaDiaria > 0 ? kilosEnStock / ventaDiaria : null

    let semaforo: CoberturaSemaforo
    if (diasCobertura == null) semaforo = 'sin_dato'
    else if (diasCobertura < 15) semaforo = 'critico'
    else if (diasCobertura <= 45) semaforo = 'ok'
    else if (diasCobertura <= 90) semaforo = 'alto'
    else semaforo = 'sobrestock'

    result.push({
      articulo: stock?.nombre ?? '—',
      articulo_id: id,
      kilosEnStock,
      kilosVendidos60d,
      ventaDiaria,
      diasCobertura,
      semaforo,
    })
  }

  // Orden: primero los críticos, después por menos días de cobertura.
  return result.sort((a, b) => {
    const da = a.diasCobertura ?? Infinity
    const db = b.diasCobertura ?? Infinity
    return da - db
  })
}

// ── Rotación ABC (Pareto) ───────────────────────────────────

export type RotacionABCRow = {
  articulo: string
  articulo_id: string
  kilosVendidos: number
  pctAcumulado: number
  clase: 'A' | 'B' | 'C'
}

export async function reporteRotacionABC(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<RotacionABCRow[]> {
  const { desde, hasta } = rangoPeriodo(filters)
  const vendidos = await kilosVendidosPorArticulo(
    supabase,
    new Date(desde).getTime(),
    new Date(hasta).getTime(),
    filters
  )

  // Nombres de artículo.
  const ids = [...vendidos.keys()]
  const nombrePorId = new Map<string, string>()
  if (ids.length > 0) {
    const { data: arts } = await supabase
      .from('articulos')
      .select('id, nombre')
      .in('id', ids)
    for (const a of arts ?? []) nombrePorId.set(a.id, a.nombre)
  }

  const ordenados = [...vendidos.entries()]
    .map(([articulo_id, kilosVendidos]) => ({
      articulo_id,
      articulo: nombrePorId.get(articulo_id) ?? '—',
      kilosVendidos,
    }))
    .sort((a, b) => b.kilosVendidos - a.kilosVendidos)

  const total = ordenados.reduce((s, r) => s + r.kilosVendidos, 0)
  let acumulado = 0
  return ordenados.map((r) => {
    acumulado += r.kilosVendidos
    const pctAcumulado = total > 0 ? (acumulado / total) * 100 : 0
    const clase: 'A' | 'B' | 'C' =
      pctAcumulado <= 80 ? 'A' : pctAcumulado <= 95 ? 'B' : 'C'
    return { ...r, pctAcumulado, clase }
  })
}

// ── Top 10 rollos más viejos en stock ───────────────────────

export type RolloViejoRow = {
  id: string
  numero_pieza: string
  articulo: string
  color: string
  ubicacion: string
  kilos: number
  created_at: string
  dias: number
}

export async function reporteRollosViejos(
  supabase: SupabaseClient,
  filters: ReportesFilters = {},
  limite = 10
): Promise<RolloViejoRow[]> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  // ⚠ PROXY DE FECHA: "días sin moverse" = now − created_at. No leemos
  // `movimientos` por rollo acá (sería 1 query extra por fila); created_at es
  // la fecha de alta del rollo, suficiente para detectar stock estancado.
  let query = supabase
    .from('rollos')
    .select(
      `id, numero_pieza, ubicacion, kilos, created_at, articulo_id, color_id,
       articulos ( nombre ), ingresos!inner ( tintoreria_id )`
    )
    .eq('estado', 'en_stock')
    .order('created_at', { ascending: true })
    .limit(limite)
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  const [{ data }, colorById] = await Promise.all([
    query,
    colorNameById(supabase),
  ])

  type Raw = {
    id: string
    numero_pieza: string
    ubicacion: string | null
    kilos: number | null
    created_at: string
    color_id: string | null
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]
  const ahora = Date.now()

  return rows.map((r) => ({
    id: r.id,
    numero_pieza: r.numero_pieza,
    articulo: r.articulos?.nombre ?? '—',
    color: r.color_id ? colorById.get(r.color_id) ?? '—' : '—',
    ubicacion: r.ubicacion ?? '—',
    kilos: Number(r.kilos ?? 0),
    created_at: r.created_at,
    dias: Math.floor((ahora - new Date(r.created_at).getTime()) / 86_400_000),
  }))
}

// ── Distribución de stock por estado ────────────────────────

export type StockPorEstadoRow = {
  estado: 'en_stock' | 'reservado' | 'segunda'
  label: string
  rollos: number
  kilos: number
}

export async function reporteStockPorEstado(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<StockPorEstadoRow[]> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)
  const tintoreriaIds = listOrSingle(filters.tintoreriaIds, filters.tintoreriaId)

  let query = supabase
    .from('rollos')
    .select('estado, kilos, articulo_id, ingresos!inner ( tintoreria_id )')
    .in('estado', ['en_stock', 'reservado', 'segunda'])
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])
  if (tintoreriaIds.length > 1)
    query = query.in('ingresos.tintoreria_id', tintoreriaIds)
  else if (tintoreriaIds.length === 1)
    query = query.eq('ingresos.tintoreria_id', tintoreriaIds[0])

  const { data } = await query

  type Raw = { estado: string; kilos: number | null }
  const rows = (data ?? []) as unknown as Raw[]

  const labels: Record<StockPorEstadoRow['estado'], string> = {
    en_stock: 'En stock',
    reservado: 'Reservado',
    segunda: 'Segunda',
  }
  const acc: Record<string, StockPorEstadoRow> = {
    en_stock: { estado: 'en_stock', label: labels.en_stock, rollos: 0, kilos: 0 },
    reservado: { estado: 'reservado', label: labels.reservado, rollos: 0, kilos: 0 },
    segunda: { estado: 'segunda', label: labels.segunda, rollos: 0, kilos: 0 },
  }
  for (const r of rows) {
    const a = acc[r.estado]
    if (!a) continue
    a.rollos += 1
    a.kilos += Number(r.kilos ?? 0)
  }
  return Object.values(acc)
}
