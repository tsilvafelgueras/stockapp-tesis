import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import { getUbicacionesActivas } from '@/lib/ubicacionesServer'
import NuevaMuestraForm, {
  type RolloOpcion,
} from './NuevaMuestraForm'

type SearchParams = {
  q?: string
  articulo?: string
  color?: string
  lote?: string
  tintoreria?: string
  ubicacion?: string
  estado?: string
  orden?: string
}

export default async function NuevaMuestraPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams
  const estado = sp.estado || 'en_stock'
  const orden = sp.orden || 'pieza_asc'

  let rollosQuery = supabase
    .from('rollos')
    .select(
      `
          id,
          numero_pieza,
          kilos,
          estado,
          articulo_id,
          color_id,
          ubicacion,
          articulos ( nombre ),
          ingresos!inner (
            numero_lote,
            tintoreria_id,
            tintorerias ( id, nombre )
          )
        `
    )
    .limit(1000)

  if (estado !== 'todos') rollosQuery = rollosQuery.eq('estado', estado)
  else rollosQuery = rollosQuery.in('estado', ['en_stock', 'reservado'])
  if (sp.q) rollosQuery = rollosQuery.ilike('numero_pieza', `%${sp.q.trim()}%`)
  if (sp.articulo) rollosQuery = rollosQuery.eq('articulo_id', sp.articulo)
  if (sp.color) rollosQuery = rollosQuery.eq('color_id', sp.color)
  if (sp.lote) rollosQuery = rollosQuery.eq('ingresos.numero_lote', sp.lote)
  if (sp.tintoreria) {
    rollosQuery = rollosQuery.eq('ingresos.tintoreria_id', sp.tintoreria)
  }
  if (sp.ubicacion) rollosQuery = rollosQuery.eq('ubicacion', sp.ubicacion)

  const [
    { data: rollosRaw },
    { data: coloresRaw },
    { data: articulos },
    { data: empresaTints },
    { data: lotesRaw },
    { data: clientesRaw },
    ubicaciones,
  ] = await Promise.all([
    rollosQuery,
    supabase.from('colores').select('id, nombre'),
    supabase
      .from('articulos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('empresa_tintorerias')
      .select('tintorerias ( id, nombre )')
      .eq('activo', true),
    supabase
      .from('ingresos')
      .select('numero_lote')
      .not('numero_lote', 'is', null),
    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    getUbicacionesActivas(supabase),
  ])

  const colorById = new Map(
    ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ])
  )

  type Raw = {
    id: string
    numero_pieza: string
    kilos: number | null
    estado: string
    articulo_id: string | null
    color_id: string | null
    ubicacion: string | null
    articulos: { nombre: string } | null
    ingresos: {
      numero_lote: string | null
      tintoreria_id: string | null
      tintorerias: { id: string; nombre: string } | null
    } | null
  }
  const rollos = ((rollosRaw ?? []) as unknown as Raw[]).map(
    (r): RolloOpcion => ({
      id: r.id,
      numero_pieza: r.numero_pieza,
      kilos: r.kilos,
      estado: r.estado,
      articuloId: r.articulo_id,
      colorId: r.color_id,
      ubicacion: r.ubicacion,
      lote: r.ingresos?.numero_lote ?? null,
      tintoreriaId: r.ingresos?.tintoreria_id ?? null,
      tintoreria: r.ingresos?.tintorerias?.nombre ?? null,
      articulo: r.articulos?.nombre ?? null,
      color: r.color_id ? colorById.get(r.color_id) ?? null : null,
    })
  )
  rollos.sort(comparadorMuestras(orden))

  type EmpresaTintRow = { tintorerias: { id: string; nombre: string } | null }
  const tintorerias = ((empresaTints ?? []) as unknown as EmpresaTintRow[])
    .map((r) => r.tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const lotes = Array.from(
    new Set(
      ((lotesRaw ?? []) as { numero_lote: string | null }[])
        .map((r) => r.numero_lote?.trim())
        .filter((v): v is string => Boolean(v))
    )
  ).sort((a, b) => b.localeCompare(a, 'es'))

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href="/muestras" label="Volver a muestras" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nueva muestra</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una entrega chica que se descuenta del rollo
        </p>
      </div>

      <NuevaMuestraForm
        rollos={rollos}
        articulos={articulos ?? []}
        colores={(coloresRaw ?? []) as { id: string; nombre: string }[]}
        tintorerias={tintorerias}
        clientes={(clientesRaw ?? []) as { id: string; nombre: string }[]}
        lotes={lotes}
        ubicaciones={ubicaciones}
        current={{
          q: sp.q ?? '',
          articulo: sp.articulo ?? '',
          color: sp.color ?? '',
          lote: sp.lote ?? '',
          tintoreria: sp.tintoreria ?? '',
          ubicacion: sp.ubicacion ?? '',
          estado,
          orden,
        }}
      />
    </div>
  )
}

function comparadorMuestras(
  orden: string
): (a: RolloOpcion, b: RolloOpcion) => number {
  switch (orden) {
    case 'kilos_desc':
      return (a, b) => Number(b.kilos ?? 0) - Number(a.kilos ?? 0)
    case 'kilos_asc':
      return (a, b) => Number(a.kilos ?? 0) - Number(b.kilos ?? 0)
    case 'pieza_desc':
      return (a, b) => b.numero_pieza.localeCompare(a.numero_pieza, 'es', {
        numeric: true,
      })
    case 'pieza_asc':
    default:
      return (a, b) => a.numero_pieza.localeCompare(b.numero_pieza, 'es', {
        numeric: true,
      })
  }
}
