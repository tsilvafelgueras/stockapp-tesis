import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import NuevoPedidoForm, {
  type RolloDisponible,
  type Catalogo,
} from './NuevoPedidoForm'

type SearchParams = {
  q?: string
  articulo?: string
  color?: string
  tintoreria?: string
  diasMinimos?: string
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
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Rollos disponibles (en_stock). Orden default por antigüedad (created_at
  // ASC) — los más viejos primero, regla FIFO pedida por la ingeniera textil
  // para evitar que los rollos pierdan propiedades en depósito. Tiebreak por
  // numero_pieza para que el orden quede determinista.
  let query = supabase
    .from('rollos')
    .select(
      `
        id,
        numero_pieza,
        ubicacion,
        kilos,
        metros,
        created_at,
        articulos ( id, nombre ),
        colores ( id, nombre ),
        ingresos!inner (
          id,
          numero_lote,
          tintorerias ( id, nombre )
        )
      `
    )
    .eq('estado', 'en_stock')
    .order('created_at', { ascending: true })
    .order('numero_pieza', { ascending: true })
    .limit(500)

  if (sp.articulo) query = query.eq('articulo_id', sp.articulo)
  if (sp.color) query = query.eq('color_id', sp.color)
  if (sp.tintoreria) query = query.eq('ingresos.tintoreria_id', sp.tintoreria)
  if (sp.q) query = query.ilike('numero_pieza', `%${sp.q.trim()}%`)

  // Filtro por antigüedad mínima: rollos con created_at <= NOW() - X días.
  // Calculamos la fecha límite en el server para evitar issues de zona horaria.
  const diasMinimos = sp.diasMinimos ? parseInt(sp.diasMinimos) : null
  if (diasMinimos && diasMinimos > 0) {
    const limite = new Date()
    limite.setDate(limite.getDate() - diasMinimos)
    query = query.lte('created_at', limite.toISOString())
  }

  const { data: rollosRaw, error } = await query
  const rollos = (rollosRaw ?? []) as unknown as RolloDisponible[]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <BackButton href="/pedidos" label="Volver a pedidos" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nuevo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Reservá rollos del stock para un cliente. Los más viejos aparecen primero.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar rollos: {error.message}
        </div>
      ) : (
        <NuevoPedidoForm
          rollosDisponibles={rollos}
          articulos={(articulos ?? []) as Catalogo[]}
          colores={(colores ?? []) as Catalogo[]}
          tintorerias={(tintorerias ?? []) as Catalogo[]}
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
