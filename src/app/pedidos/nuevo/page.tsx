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
}

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams

  // Catálogos para los dropdowns
  const [{ data: articulos }, { data: tintorerias }, { data: clientes }] =
    await Promise.all([
      supabase
        .from('articulos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('tintorerias')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('clientes')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
    ])

  // Rollos disponibles (en_stock) con filtros opcionales. !inner sobre
  // ingresos para poder filtrar por color y tintorería del ingreso.
  let query = supabase
    .from('rollos')
    .select(
      `
        id,
        numero_pieza,
        ubicacion,
        kilos,
        metros,
        articulos ( id, nombre ),
        ingresos!inner (
          id,
          color,
          numero_lote,
          tintorerias ( id, nombre )
        )
      `
    )
    .eq('estado', 'en_stock')
    .order('numero_pieza', { ascending: true })
    .limit(500)

  if (sp.articulo) query = query.eq('articulo_id', sp.articulo)
  if (sp.tintoreria) query = query.eq('ingresos.tintoreria_id', sp.tintoreria)
  if (sp.q) query = query.ilike('numero_pieza', `%${sp.q.trim()}%`)
  if (sp.color) query = query.ilike('ingresos.color', `%${sp.color.trim()}%`)

  const { data: rollosRaw, error } = await query
  const rollos = (rollosRaw ?? []) as unknown as RolloDisponible[]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <BackButton href="/pedidos" label="Volver a pedidos" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nuevo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Reservá rollos del stock para un cliente
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
          tintorerias={(tintorerias ?? []) as Catalogo[]}
          clientes={(clientes ?? []) as Catalogo[]}
          currentFilters={{
            q: sp.q ?? '',
            articulo: sp.articulo ?? '',
            color: sp.color ?? '',
            tintoreria: sp.tintoreria ?? '',
          }}
        />
      )}
    </div>
  )
}
