import {
  type ReportesFilters,
  type SupabaseClient,
  rangoPeriodo,
} from './_shared'

// ════════════════════════════════════════════════════════════
//  BLOQUE E — Eficiencia operativa
//  "¿La operación mejora o empeora?"
//
//  Métricas a nivel sistema: los filtros de artículo/tintorería no
//  aplican acá (son indicadores de uso de la herramienta).
// ════════════════════════════════════════════════════════════

const MES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]
function ymLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MES_CORTO[Number(m) - 1]} ${y.slice(2)}`
}

// ── Ingresos: IA vs manual ──────────────────────────────────

export type OrigenMes = { ym: string; label: string; ia: number; manual: number }
export type OrigenResult = {
  ia: number
  manual: number
  total: number
  iaPct: number
  meses: OrigenMes[]
}

export async function reporteOrigenIngresos(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<OrigenResult> {
  const { desde, hasta } = rangoPeriodo(filters)

  const { data } = await supabase
    .from('ingresos')
    .select('origen, created_at')
    .gte('created_at', desde)
    .lt('created_at', hasta)
    .limit(10000)

  type Raw = { origen: string | null; created_at: string }
  const rows = (data ?? []) as unknown as Raw[]

  let ia = 0
  let manual = 0
  const porMes = new Map<string, OrigenMes>()
  for (const r of rows) {
    const esIa = r.origen === 'planilla_ia'
    if (esIa) ia += 1
    else manual += 1
    const ym = r.created_at.slice(0, 7)
    const mes = porMes.get(ym) ?? { ym, label: ymLabel(ym), ia: 0, manual: 0 }
    if (esIa) mes.ia += 1
    else mes.manual += 1
    porMes.set(ym, mes)
  }

  const total = ia + manual
  return {
    ia,
    manual,
    total,
    iaPct: total > 0 ? (ia / total) * 100 : 0,
    meses: [...porMes.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
  }
}

// ── Tendencia mensual: kilos in / out / neto acumulado ──────

export type TendenciaMes = {
  ym: string
  label: string
  ingresadosKg: number
  egresadosKg: number
  netoAcumKg: number
}

export async function reporteTendenciaMensual(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<TendenciaMes[]> {
  const { desde, hasta } = rangoPeriodo(filters)

  // ⚠ PROXY DE FECHA: ingresos = alta del rollo (created_at). Egresos =
  // pedidos entregados (confirmada_egreso_at, con caída a created_at).
  const [{ data: rollosData }, { data: pedidosData }] = await Promise.all([
    supabase
      .from('rollos')
      .select('kilos, created_at')
      .gte('created_at', desde)
      .lt('created_at', hasta)
      .limit(20000),
    supabase
      .from('pedidos')
      .select('created_at, confirmada_egreso_at, pedido_rollos ( rollos ( kilos ) )')
      .eq('estado', 'entregada')
      .limit(5000),
  ])

  const ingresadosPorMes = new Map<string, number>()
  for (const r of (rollosData ?? []) as { kilos: number | null; created_at: string }[]) {
    const ym = r.created_at.slice(0, 7)
    ingresadosPorMes.set(ym, (ingresadosPorMes.get(ym) ?? 0) + Number(r.kilos ?? 0))
  }

  type PedRaw = {
    created_at: string
    confirmada_egreso_at: string | null
    pedido_rollos: { rollos: { kilos: number | null } | null }[] | null
  }
  const desdeMs = new Date(desde).getTime()
  const hastaMs = new Date(hasta).getTime()
  const egresadosPorMes = new Map<string, number>()
  for (const p of (pedidosData ?? []) as unknown as PedRaw[]) {
    const fechaIso = p.confirmada_egreso_at ?? p.created_at
    const fechaMs = new Date(fechaIso).getTime()
    if (fechaMs < desdeMs || fechaMs >= hastaMs) continue
    const ym = fechaIso.slice(0, 7)
    const kg = (p.pedido_rollos ?? []).reduce(
      (s, pr) => s + Number(pr.rollos?.kilos ?? 0),
      0
    )
    egresadosPorMes.set(ym, (egresadosPorMes.get(ym) ?? 0) + kg)
  }

  const meses = [
    ...new Set([...ingresadosPorMes.keys(), ...egresadosPorMes.keys()]),
  ].sort()

  let acum = 0
  return meses.map((ym) => {
    const ingresadosKg = ingresadosPorMes.get(ym) ?? 0
    const egresadosKg = egresadosPorMes.get(ym) ?? 0
    acum += ingresadosKg - egresadosKg
    return {
      ym,
      label: ymLabel(ym),
      ingresadosKg,
      egresadosKg,
      netoAcumKg: acum,
    }
  })
}

// ── Health check del sistema ────────────────────────────────

export type HealthCheck = {
  ingresosConPlanillaPct: number
  ingresosTotal: number
  rollosConUbicacionPct: number
  rollosTotal: number
}

export async function reporteHealthCheck(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<HealthCheck> {
  const { desde, hasta } = rangoPeriodo(filters)

  const [{ data: ingresos }, { data: rollos }] = await Promise.all([
    supabase
      .from('ingresos')
      .select('imagen_url, created_at')
      .gte('created_at', desde)
      .lt('created_at', hasta)
      .limit(10000),
    supabase
      .from('rollos')
      .select('ubicacion, created_at')
      .gte('created_at', desde)
      .lt('created_at', hasta)
      .limit(20000),
  ])

  const ing = (ingresos ?? []) as { imagen_url: string | null }[]
  const rol = (rollos ?? []) as { ubicacion: string | null }[]

  const conPlanilla = ing.filter((i) => !!i.imagen_url).length
  const conUbicacion = rol.filter(
    (r) => !!r.ubicacion && r.ubicacion.trim() !== ''
  ).length

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

  return {
    ingresosTotal: ing.length,
    ingresosConPlanillaPct: pct(conPlanilla, ing.length),
    rollosTotal: rol.length,
    rollosConUbicacionPct: pct(conUbicacion, rol.length),
  }
}

// ── Actividad por usuario (vía movimientos) ─────────────────

export type ActividadUsuarioRow = {
  usuario: string
  cargados: number // rollos creados
  confirmados: number // cambios de estado de rollos (incluye confirmación/auditoría)
  pickeados: number // rollos pickeados
}

export async function reporteActividadUsuarios(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<ActividadUsuarioRow[]> {
  const { desde, hasta } = rangoPeriodo(filters)

  // movimientos solo es legible por admin (RLS). Registra desde la mig. 021.
  const { data } = await supabase
    .from('movimientos')
    .select('usuario_id, entidad, accion, created_at')
    .gte('created_at', desde)
    .lt('created_at', hasta)
    .limit(50000)

  type MovRaw = {
    usuario_id: string | null
    entidad: string
    accion: string
  }
  const movs = (data ?? []) as unknown as MovRaw[]

  type Acc = { cargados: number; confirmados: number; pickeados: number }
  const porUsuario = new Map<string, Acc>()
  for (const m of movs) {
    if (!m.usuario_id) continue
    const acc =
      porUsuario.get(m.usuario_id) ?? { cargados: 0, confirmados: 0, pickeados: 0 }
    if (m.entidad === 'rollo' && m.accion === 'crear') acc.cargados += 1
    else if (m.entidad === 'rollo' && m.accion === 'cambiar_estado')
      acc.confirmados += 1
    else if (m.entidad === 'pedido_rollo' && m.accion === 'pickear')
      acc.pickeados += 1
    porUsuario.set(m.usuario_id, acc)
  }

  const ids = [...porUsuario.keys()]
  if (ids.length === 0) return []

  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, nombre')
    .in('id', ids)
  const nombre = new Map(
    ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      p.nombre ?? 'Usuario',
    ])
  )

  return [...porUsuario.entries()]
    .map(([id, a]) => ({ usuario: nombre.get(id) ?? 'Usuario', ...a }))
    .filter((r) => r.cargados + r.confirmados + r.pickeados > 0)
    .sort(
      (a, b) =>
        b.cargados + b.confirmados + b.pickeados -
        (a.cargados + a.confirmados + a.pickeados)
    )
}
