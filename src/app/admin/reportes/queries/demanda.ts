import {
  type ReportesFilters,
  type SupabaseClient,
  colorNameById,
  listOrSingle,
  rangoPeriodo,
} from './_shared'

// ════════════════════════════════════════════════════════════
//  BLOQUE B — Demanda comercial
//  "¿Qué producir y a quién le vendo?"
// ════════════════════════════════════════════════════════════

// ── Demanda no satisfecha (pedidos_pendientes activos) ──────

export type DemandaActivaRow = {
  id: string
  cliente: string
  articulo: string
  articulo_id: string | null
  color: string
  kilos: number
  metros: number
  prioridad: string
  fechaRequerida: string | null
  created_at: string
  dias: number
}

export async function reporteDemandaActiva(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<DemandaActivaRow[]> {
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)

  // Demanda = lo que un cliente pidió y no había stock. Snapshot de lo
  // activo hoy (no depende del período).
  let query = supabase
    .from('pedidos_pendientes')
    .select(
      `id, cliente, articulo_id, color_id, color, kilos_estimados,
       metros_estimados, prioridad, fecha_requerida, created_at,
       articulos ( nombre )`
    )
    .eq('estado', 'activo')
    .order('created_at', { ascending: true })
  if (articuloIds.length > 1) query = query.in('articulo_id', articuloIds)
  else if (articuloIds.length === 1) query = query.eq('articulo_id', articuloIds[0])

  const [{ data }, colorById] = await Promise.all([
    query,
    colorNameById(supabase),
  ])

  type Raw = {
    id: string
    cliente: string
    articulo_id: string | null
    color_id: string | null
    color: string | null
    kilos_estimados: number | null
    metros_estimados: number | null
    prioridad: string
    fecha_requerida: string | null
    created_at: string
    articulos: { nombre: string } | null
  }
  const rows = (data ?? []) as unknown as Raw[]
  const ahora = Date.now()

  return rows.map((r) => ({
    id: r.id,
    cliente: r.cliente,
    articulo: r.articulos?.nombre ?? '—',
    articulo_id: r.articulo_id,
    // Preferimos el color normalizado (color_id); si falta, el texto libre.
    color: r.color_id ? colorById.get(r.color_id) ?? '—' : r.color ?? '—',
    kilos: Number(r.kilos_estimados ?? 0),
    metros: Number(r.metros_estimados ?? 0),
    prioridad: r.prioridad,
    fechaRequerida: r.fecha_requerida,
    created_at: r.created_at,
    dias: Math.floor((ahora - new Date(r.created_at).getTime()) / 86_400_000),
  }))
}

// ── Funnel de pedidos por estado ────────────────────────────

export type FunnelRow = {
  estado: string
  label: string
  pedidos: number
}

// Orden canónico del flujo (cancelada se reporta aparte).
const FUNNEL_ESTADOS: { estado: string; label: string }[] = [
  { estado: 'pendiente', label: 'Pendiente' },
  { estado: 'en_preparacion', label: 'En preparación' },
  { estado: 'lista', label: 'Lista' },
  { estado: 'confirmada_egreso', label: 'Egreso confirmado' },
  { estado: 'entregada', label: 'Entregada' },
]

export async function reporteFunnelPedidos(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<FunnelRow[]> {
  const { desde, hasta } = rangoPeriodo(filters)

  const { data } = await supabase
    .from('pedidos')
    .select('estado, created_at')
    .gte('created_at', desde)
    .lt('created_at', hasta)

  const counts = new Map<string, number>()
  for (const p of data ?? [])
    counts.set(p.estado, (counts.get(p.estado) ?? 0) + 1)

  return FUNNEL_ESTADOS.map((e) => ({
    ...e,
    pedidos: counts.get(e.estado) ?? 0,
  }))
}

// ── Tiempo promedio por etapa (vía movimientos) ─────────────

export type TiempoEtapaRow = {
  etapa: string
  label: string
  diasPromedio: number | null
  pedidosMedidos: number
}

// Transiciones del flujo que medimos.
const TRANSICIONES: { from: string; to: string; label: string }[] = [
  { from: 'pendiente', to: 'en_preparacion', label: 'A preparación' },
  { from: 'en_preparacion', to: 'lista', label: 'A lista' },
  { from: 'lista', to: 'confirmada_egreso', label: 'A egreso' },
  { from: 'confirmada_egreso', to: 'entregada', label: 'A entrega' },
]

export async function reporteTiempoPorEtapa(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<TiempoEtapaRow[]> {
  const { desde, hasta } = rangoPeriodo(filters)

  // movimientos registra cada cambio de estado de pedidos desde la migración
  // 021. Reconstruimos la línea de tiempo de cada pedido y medimos la duración
  // real entre etapas. ⚠ Solo cubre pedidos posteriores a esa migración.
  const { data } = await supabase
    .from('movimientos')
    .select('entidad_id, accion, detalle, created_at')
    .eq('entidad', 'pedido')
    .in('accion', ['crear', 'cambiar_estado'])
    .order('created_at', { ascending: true })
    .limit(10000)

  type MovRaw = {
    entidad_id: string
    accion: string
    detalle: {
      estado?: string
      cambios?: { estado?: [string, string] }
    } | null
    created_at: string
  }
  const movs = (data ?? []) as unknown as MovRaw[]

  // Por pedido: timestamp en que entró a cada estado.
  const timeline = new Map<string, Map<string, number>>()
  for (const m of movs) {
    const estadoEntrada =
      m.accion === 'crear'
        ? m.detalle?.estado ?? 'pendiente'
        : m.detalle?.cambios?.estado?.[1]
    if (!estadoEntrada) continue
    const ts = new Date(m.created_at).getTime()
    const porPedido = timeline.get(m.entidad_id) ?? new Map<string, number>()
    // Si entró más de una vez a un estado, nos quedamos con la primera.
    if (!porPedido.has(estadoEntrada)) porPedido.set(estadoEntrada, ts)
    timeline.set(m.entidad_id, porPedido)
  }

  const desdeMs = new Date(desde).getTime()
  const hastaMs = new Date(hasta).getTime()

  const acumulado = TRANSICIONES.map(() => ({ suma: 0, n: 0 }))

  for (const estados of timeline.values()) {
    // Filtramos por período usando la fecha de creación del pedido (pendiente).
    const creado = estados.get('pendiente')
    if (creado != null && (creado < desdeMs || creado >= hastaMs)) continue
    TRANSICIONES.forEach((t, i) => {
      const a = estados.get(t.from)
      const b = estados.get(t.to)
      if (a != null && b != null && b >= a) {
        acumulado[i].suma += b - a
        acumulado[i].n += 1
      }
    })
  }

  return TRANSICIONES.map((t, i) => ({
    etapa: `${t.from}->${t.to}`,
    label: t.label,
    diasPromedio:
      acumulado[i].n > 0
        ? acumulado[i].suma / acumulado[i].n / 86_400_000
        : null,
    pedidosMedidos: acumulado[i].n,
  }))
}

// ── Ranking de clientes ─────────────────────────────────────

export type ClienteRankingRow = {
  cliente: string
  pedidos: number
  kilos: number
  ticketPromedio: number
}

export async function reporteRankingClientes(
  supabase: SupabaseClient,
  filters: ReportesFilters = {},
  limite = 10
): Promise<ClienteRankingRow[]> {
  const { desde, hasta } = rangoPeriodo(filters)
  const articuloIds = listOrSingle(filters.articuloIds, filters.articuloId)

  // Clientes por kilos comprados = pedidos entregados en el período.
  // ⚠ PROXY DE FECHA: confirmada_egreso_at, con caída a created_at.
  const { data } = await supabase
    .from('pedidos')
    .select(
      `cliente, created_at, confirmada_egreso_at,
       pedido_rollos ( rollos ( kilos, articulo_id ) )`
    )
    .eq('estado', 'entregada')
    .limit(5000)

  type PedRaw = {
    cliente: string
    created_at: string
    confirmada_egreso_at: string | null
    pedido_rollos:
      | { rollos: { kilos: number | null; articulo_id: string | null } | null }[]
      | null
  }
  const pedidos = (data ?? []) as unknown as PedRaw[]
  const desdeMs = new Date(desde).getTime()
  const hastaMs = new Date(hasta).getTime()

  const map = new Map<string, { pedidos: number; kilos: number }>()
  for (const p of pedidos) {
    const fecha = new Date(p.confirmada_egreso_at ?? p.created_at).getTime()
    if (fecha < desdeMs || fecha >= hastaMs) continue

    let kilosPedido = 0
    let tieneMatch = articuloIds.length === 0
    for (const pr of p.pedido_rollos ?? []) {
      const r = pr.rollos
      if (!r) continue
      if (articuloIds.length > 0 && !articuloIds.includes(r.articulo_id ?? ''))
        continue
      kilosPedido += Number(r.kilos ?? 0)
      tieneMatch = true
    }
    if (!tieneMatch) continue

    const acc = map.get(p.cliente) ?? { pedidos: 0, kilos: 0 }
    acc.pedidos += 1
    acc.kilos += kilosPedido
    map.set(p.cliente, acc)
  }

  return [...map.entries()]
    .map(([cliente, v]) => ({
      cliente,
      pedidos: v.pedidos,
      kilos: v.kilos,
      ticketPromedio: v.pedidos > 0 ? v.kilos / v.pedidos : 0,
    }))
    .sort((a, b) => b.kilos - a.kilos)
    .slice(0, limite)
}

// ── Pedidos caídos / cancelados ─────────────────────────────

export type PedidoCaidoRow = {
  numero_pedido: string
  cliente: string
  motivo: string
  kilos: number
  fecha: string
}

// Grupo expandible: un motivo con su conteo, kilos totales y el detalle
// de cada pedido que cayó por ese motivo.
export type MotivoCaidaGroup = {
  motivo: string
  label: string
  pedidos: number
  kilos: number
  detalle: PedidoCaidoRow[]
}

export type CanceladosResult = {
  totalPedidos: number
  kilosLiberados: number
  porMotivo: MotivoCaidaGroup[]
  lista: PedidoCaidoRow[]
}

const MOTIVO_LABEL: Record<string, string> = {
  cliente_cancelo: 'Cliente canceló',
  precio: 'Precio',
  otro_proveedor: 'Otro proveedor',
  sin_respuesta: 'Sin respuesta',
  otro: 'Otro',
  sin_motivo: 'Sin motivo registrado',
}

export async function reportePedidosCancelados(
  supabase: SupabaseClient,
  filters: ReportesFilters = {}
): Promise<CanceladosResult> {
  const { desde, hasta } = rangoPeriodo(filters)

  const { data } = await supabase
    .from('pedidos')
    .select(
      `numero_pedido, cliente, caida_motivo, caida_at, created_at,
       pedido_rollos ( rollos ( kilos ) )`
    )
    .eq('estado', 'cancelada')
    .limit(5000)

  type PedRaw = {
    numero_pedido: string
    cliente: string
    caida_motivo: string | null
    caida_at: string | null
    created_at: string
    pedido_rollos: { rollos: { kilos: number | null } | null }[] | null
  }
  const pedidos = (data ?? []) as unknown as PedRaw[]
  const desdeMs = new Date(desde).getTime()
  const hastaMs = new Date(hasta).getTime()

  const grupos = new Map<string, MotivoCaidaGroup>()
  const lista: PedidoCaidoRow[] = []
  let kilosLiberados = 0

  for (const p of pedidos) {
    const fecha = new Date(p.caida_at ?? p.created_at).getTime()
    if (fecha < desdeMs || fecha >= hastaMs) continue

    const kilos = (p.pedido_rollos ?? []).reduce(
      (s, pr) => s + Number(pr.rollos?.kilos ?? 0),
      0
    )
    kilosLiberados += kilos
    const motivo = p.caida_motivo ?? 'sin_motivo'
    const row: PedidoCaidoRow = {
      numero_pedido: p.numero_pedido,
      cliente: p.cliente,
      motivo,
      kilos,
      fecha: p.caida_at ?? p.created_at,
    }
    lista.push(row)

    const grupo =
      grupos.get(motivo) ??
      ({
        motivo,
        label: MOTIVO_LABEL[motivo] ?? motivo,
        pedidos: 0,
        kilos: 0,
        detalle: [],
      } as MotivoCaidaGroup)
    grupo.pedidos += 1
    grupo.kilos += kilos
    grupo.detalle.push(row)
    grupos.set(motivo, grupo)
  }

  lista.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // Cada grupo ordena su detalle por fecha desc; los grupos se ordenan por
  // cantidad de pedidos desc (el motivo más usado primero).
  const porMotivo = [...grupos.values()].sort((a, b) => b.pedidos - a.pedidos)
  for (const g of porMotivo)
    g.detalle.sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )

  return {
    totalPedidos: lista.length,
    kilosLiberados,
    porMotivo,
    lista,
  }
}
