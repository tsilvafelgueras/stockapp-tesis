import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ── Stock por artículo+color ───────────────────────────────

export type StockRow = {
  articulo: string
  color: string
  rollos: number
  kilos: number
}

export async function reporteStock(
  supabase: SupabaseClient
): Promise<StockRow[]> {
  const { data } = await supabase
    .from('rollos')
    .select(
      'kilos, articulos!inner ( nombre ), ingresos!inner ( color )'
    )
    .eq('estado', 'en_stock')

  type Raw = {
    kilos: number | null
    articulos: { nombre: string } | null
    ingresos: { color: string | null } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  const map = new Map<string, StockRow>()
  for (const r of rows) {
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.ingresos?.color ?? '—'
    const key = `${articulo}|||${color}`
    const prev = map.get(key) ?? { articulo, color, rollos: 0, kilos: 0 }
    prev.rollos += 1
    prev.kilos += Number(r.kilos ?? 0)
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.kilos - a.kilos)
}

// ── Movimientos del mes ─────────────────────────────────────

export type MovimientosResult = {
  mes: string
  ingresosRollos: number
  ingresosKilos: number
  egresosRollos: number
  egresosKilos: number
  pedidosEntregados: number
}

export async function reporteMovimientos(
  supabase: SupabaseClient
): Promise<MovimientosResult> {
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const inicioIso = inicioMes.toISOString()
  const mesLabel = inicioMes.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  // Ingresos: rollos creados este mes (proxy de "qué entró al sistema")
  const { data: rollosMes } = await supabase
    .from('rollos')
    .select('kilos')
    .gte('created_at', inicioIso)

  const ingresosRollos = rollosMes?.length ?? 0
  const ingresosKilos =
    rollosMes?.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0) ?? 0

  // Egresos: pedidos entregados este mes (proxy: created_at en estado entregada)
  // Sin updated_at confiable, usamos pedidos creados este mes que ya están entregados.
  const { data: pedidosEntregadosRaw } = await supabase
    .from('pedidos')
    .select(
      `id, pedido_rollos ( rollos ( kilos ) )`
    )
    .eq('estado', 'entregada')
    .gte('created_at', inicioIso)

  type PedRaw = {
    id: string
    pedido_rollos:
      | { rollos: { kilos: number | null } | null }[]
      | null
  }
  const pedidos = (pedidosEntregadosRaw ?? []) as unknown as PedRaw[]

  let egresosRollos = 0
  let egresosKilos = 0
  for (const p of pedidos) {
    for (const pr of p.pedido_rollos ?? []) {
      egresosRollos += 1
      egresosKilos += Number(pr.rollos?.kilos ?? 0)
    }
  }

  return {
    mes: mesLabel,
    ingresosRollos,
    ingresosKilos,
    egresosRollos,
    egresosKilos,
    pedidosEntregados: pedidos.length,
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
  supabase: SupabaseClient
): Promise<DiferenciaRow[]> {
  const { data } = await supabase
    .from('rollos')
    .select(
      `id, numero_pieza, kilos, kilos_propios,
       articulos ( nombre ),
       ingresos ( color )`
    )
    .not('kilos_propios', 'is', null)
    .order('numero_pieza', { ascending: true })

  type Raw = {
    id: string
    numero_pieza: string
    kilos: number | null
    kilos_propios: number | null
    articulos: { nombre: string } | null
    ingresos: { color: string | null } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  return rows.map((r) => {
    const k = Number(r.kilos ?? 0)
    const kp = Number(r.kilos_propios ?? 0)
    return {
      id: r.id,
      numero_pieza: r.numero_pieza,
      articulo: r.articulos?.nombre ?? '—',
      color: r.ingresos?.color ?? '—',
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
  supabase: SupabaseClient
): Promise<MermaResult> {
  const { data } = await supabase
    .from('rollos')
    .select(`kilos, kilos_propios, articulos ( nombre ), ingresos ( color )`)
    .not('kilos_propios', 'is', null)
    .not('kilos', 'is', null)

  type Raw = {
    kilos: number | null
    kilos_propios: number | null
    articulos: { nombre: string } | null
    ingresos: { color: string | null } | null
  }
  const rows = (data ?? []) as unknown as Raw[]

  const map = new Map<string, MermaRow>()
  for (const r of rows) {
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.ingresos?.color ?? '—'
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
  dias: number
): Promise<AntiguedadRow[]> {
  const limite = new Date()
  limite.setDate(limite.getDate() - dias)
  const limiteIso = limite.toISOString()

  const { data } = await supabase
    .from('rollos')
    .select(
      `id, numero_pieza, ubicacion, kilos, created_at,
       articulos ( nombre ),
       ingresos ( color )`
    )
    .eq('estado', 'en_stock')
    .lt('created_at', limiteIso)
    .order('created_at', { ascending: true })

  type Raw = {
    id: string
    numero_pieza: string
    ubicacion: string | null
    kilos: number | null
    created_at: string
    articulos: { nombre: string } | null
    ingresos: { color: string | null } | null
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
      color: r.ingresos?.color ?? '—',
      ubicacion: r.ubicacion ?? '—',
      kilos: Number(r.kilos ?? 0),
      created_at: r.created_at,
      dias: diasReales,
    }
  })
}
