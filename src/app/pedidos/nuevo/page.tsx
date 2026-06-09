import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import NuevoPedidoForm, {
  type Catalogo,
  type PartidaDisponible,
} from './NuevoPedidoForm'

type SearchParams = {
  q?: string
  articulo?: string
  color?: string
  tintoreria?: string
  diasMinimos?: string
}

type RolloRaw = {
  id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  created_at: string
  articulo_id: string
  color_id: string
  articulos: { id: string; nombre: string } | null
  ingresos: {
    id: string
    numero_lote: string | null
    tintoreria_id: string | null
    tintorerias: { id: string; nombre: string } | null
  } | null
}

type PedidoPartidaRaw = {
  ingreso_id: string
  articulo_id: string
  color_id: string
  rollos_solicitados: number
  pedido_rollos: { id: string; liberado_at: string | null }[] | null
}

type GrupoPartida = {
  ingresoId: string
  numeroLote: string | null
  articuloId: string
  articuloNombre: string
  colorId: string
  colorNombre: string
  tintoreriaNombre: string | null
  rollos: Array<{
    id: string
    numeroPieza: string
    ubicacion: string | null
    kilos: number
    createdAt: string
  }>
}

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams

  const [{ data: articulos }, { data: colores }, { data: empresaTints }, { data: clientes }] =
    await Promise.all([
      supabase
        .from('articulos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('colores')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('empresa_tintorerias')
        .select('tintorerias ( id, nombre )')
        .eq('activo', true),
      supabase
        .from('clientes')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
    ])

  type EmpresaTintRow = { tintorerias: { id: string; nombre: string } | null }
  const tintorerias = ((empresaTints ?? []) as unknown as EmpresaTintRow[])
    .map((r) => r.tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const colorById = new Map(
    ((colores ?? []) as Catalogo[]).map((c) => [c.id, c.nombre])
  )

  let qRollos = supabase
    .from('rollos')
    .select(
      `
        id,
        numero_pieza,
        ubicacion,
        kilos,
        created_at,
        articulo_id,
        color_id,
        articulos ( id, nombre ),
        ingresos!inner (
          id,
          numero_lote,
          tintoreria_id,
          tintorerias ( id, nombre )
        )
      `
    )
    .eq('estado', 'en_stock')
    .order('created_at', { ascending: true })
    .order('numero_pieza', { ascending: true })
    .limit(1500)

  if (sp.articulo) qRollos = qRollos.eq('articulo_id', sp.articulo)
  if (sp.color) qRollos = qRollos.eq('color_id', sp.color)
  if (sp.tintoreria) qRollos = qRollos.eq('ingresos.tintoreria_id', sp.tintoreria)

  const diasMinimos = sp.diasMinimos ? parseInt(sp.diasMinimos) : null
  if (diasMinimos && diasMinimos > 0) {
    const limite = new Date()
    limite.setDate(limite.getDate() - diasMinimos)
    qRollos = qRollos.lte('created_at', limite.toISOString())
  }

  const [{ data: rollosRaw, error }, { data: pendientesRaw }] = await Promise.all([
    qRollos,
    supabase
      .from('pedido_partidas')
      .select(
        `
          ingreso_id,
          articulo_id,
          color_id,
          rollos_solicitados,
          pedidos!inner ( estado ),
          pedido_rollos ( id, liberado_at )
        `
      )
      .in('pedidos.estado', [
        'pendiente',
        'en_preparacion',
        'lista',
      ]),
  ])

  const pendientesPorPartida = new Map<string, number>()
  for (const p of (pendientesRaw ?? []) as unknown as PedidoPartidaRaw[]) {
    const key = keyPartida(p.ingreso_id, p.articulo_id, p.color_id)
    const reservados = Number(p.rollos_solicitados ?? 0)
    pendientesPorPartida.set(key, (pendientesPorPartida.get(key) ?? 0) + reservados)
  }

  const grupos = new Map<string, GrupoPartida>()
  for (const r of (rollosRaw ?? []) as unknown as RolloRaw[]) {
    if (!r.ingresos || !r.articulo_id || !r.color_id) continue
    const key = keyPartida(r.ingresos.id, r.articulo_id, r.color_id)
    const grupo =
      grupos.get(key) ??
      ({
        ingresoId: r.ingresos.id,
        numeroLote: r.ingresos.numero_lote,
        articuloId: r.articulo_id,
        articuloNombre: r.articulos?.nombre ?? 'Articulo',
        colorId: r.color_id,
        colorNombre: colorById.get(r.color_id) ?? 'Color',
        tintoreriaNombre: r.ingresos.tintorerias?.nombre ?? null,
        rollos: [],
      } satisfies GrupoPartida)

    grupo.rollos.push({
      id: r.id,
      numeroPieza: r.numero_pieza,
      ubicacion: r.ubicacion,
      kilos: Number(r.kilos ?? 0),
      createdAt: r.created_at,
    })
    grupos.set(key, grupo)
  }

  const search = sp.q?.trim().toLowerCase() ?? ''
  const partidas: PartidaDisponible[] = Array.from(grupos.values())
    .map((g) => {
      g.rollos.sort((a, b) => {
        const byDate = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        if (byDate !== 0) return byDate
        return a.numeroPieza.localeCompare(b.numeroPieza, 'es', { numeric: true })
      })
      const key = keyPartida(g.ingresoId, g.articuloId, g.colorId)
      const pendientes = pendientesPorPartida.get(key) ?? 0
      const rollosEstimacion = g.rollos.slice(pendientes)
      const kilosDisponibles = rollosEstimacion.reduce((acc, r) => acc + r.kilos, 0)
      return {
        key,
        ingresoId: g.ingresoId,
        numeroLote: g.numeroLote,
        articuloId: g.articuloId,
        articuloNombre: g.articuloNombre,
        colorId: g.colorId,
        colorNombre: g.colorNombre,
        tintoreriaNombre: g.tintoreriaNombre,
        rollosDisponibles: rollosEstimacion.length,
        kilosDisponibles,
        rollosPendientesPrevios: pendientes,
        rollosEstimacion: rollosEstimacion.map((r) => ({
          numeroPieza: r.numeroPieza,
          kilos: r.kilos,
          ubicacion: r.ubicacion,
        })),
      }
    })
    .filter((p) => p.rollosDisponibles > 0)
    .filter((p) => {
      if (!search) return true
      return (
        p.numeroLote?.toLowerCase().includes(search) ||
        p.articuloNombre.toLowerCase().includes(search) ||
        p.colorNombre.toLowerCase().includes(search) ||
        p.rollosEstimacion.some((r) => r.numeroPieza.toLowerCase().includes(search))
      )
    })
    .sort((a, b) => {
      const byLote = (a.numeroLote ?? '').localeCompare(b.numeroLote ?? '', 'es', {
        numeric: true,
      })
      if (byLote !== 0) return byLote
      return a.articuloNombre.localeCompare(b.articuloNombre, 'es')
    })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <BackButton href="/pedidos" label="Volver a pedidos" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nuevo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Elegi la partida y la cantidad de rollos. Deposito define las piezas reales al pickear.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar partidas: {error.message}
        </div>
      ) : (
        <NuevoPedidoForm
          partidasDisponibles={partidas}
          articulos={(articulos ?? []) as Catalogo[]}
          colores={(colores ?? []) as Catalogo[]}
          tintorerias={tintorerias}
          clientes={(clientes ?? []) as Catalogo[]}
          currentFilters={{
            q: sp.q ?? '',
            articulo: sp.articulo ?? '',
            color: sp.color ?? '',
            tintoreria: sp.tintoreria ?? '',
            diasMinimos: sp.diasMinimos ?? '',
          }}
        />
      )}
    </div>
  )
}

function keyPartida(ingresoId: string, articuloId: string, colorId: string) {
  return `${ingresoId}|${articuloId}|${colorId}`
}
