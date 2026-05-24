import { Boxes, Search } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StockFilters from './StockFilters'
import StockList, { type StockRollo, type StockRole } from './StockList'

const ESTADO_LABEL: Record<string, string> = {
  en_stock: 'En stock',
  segunda: 'Segunda',
  reservado: 'Reservado',
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  baja: 'Baja',
  todos: 'Todos',
}

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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const sp = await searchParams
  const estado = sp.estado || 'en_stock'
  const orden = sp.orden || 'reciente'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'ventas') as StockRole

  const [
    { data: articulos },
    { data: tintorerias },
    { data: coloresRaw },
    { data: lotesRaw },
  ] = await Promise.all([
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
      .from('ingresos')
      .select('color')
      .not('color', 'is', null),
    supabase
      .from('ingresos')
      .select('numero_lote')
      .not('numero_lote', 'is', null),
  ])

  const colores = Array.from(
    new Set(
      ((coloresRaw ?? []) as { color: string | null }[])
        .map((r) => r.color?.trim())
        .filter((c): c is string => Boolean(c))
    )
  ).sort((a, b) => a.localeCompare(b, 'es'))

  const lotes = Array.from(
    new Set(
      ((lotesRaw ?? []) as { numero_lote: string | null }[])
        .map((r) => r.numero_lote?.trim())
        .filter((c): c is string => Boolean(c))
    )
  ).sort((a, b) => b.localeCompare(a, 'es'))

  let query = supabase
    .from('rollos')
    .select(
      `
        id,
        numero_pieza,
        ubicacion,
        pantone,
        foto_url,
        kilos,
        metros,
        kilos_propios,
        metros_propios,
        ancho_propio,
        gramaje_propio,
        gramaje_planilla,
        estado,
        falla_categoria,
        falla_descripcion,
        created_at,
        auditado_at,
        articulos ( id, nombre ),
        ingresos!inner (
          id,
          fecha_despacho,
          numero_remito,
          numero_lote,
          color,
          ot,
          rem_tejeduria,
          referencia,
          tintorerias ( id, nombre )
        )
      `
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (estado !== 'todos') query = query.eq('estado', estado)
  if (sp.articulo) query = query.eq('articulo_id', sp.articulo)
  if (sp.tintoreria) {
    query = query.eq('ingresos.tintoreria_id', sp.tintoreria)
  }
  if (sp.q) query = query.ilike('numero_pieza', `%${sp.q.trim()}%`)
  if (sp.ubicacion) query = query.ilike('ubicacion', `%${sp.ubicacion.trim()}%`)
  if (sp.color) query = query.eq('ingresos.color', sp.color)
  if (sp.lote) query = query.eq('ingresos.numero_lote', sp.lote)

  const { data: rollosRaw, error } = await query
  const rollos = (rollosRaw ?? []) as unknown as StockRollo[]

  // Ordenamiento en cliente del set ya filtrado. El query usa
  // `created_at desc` como base; aquí lo reordenamos según la preferencia
  // del usuario sin volver a pegarle a la base.
  rollos.sort(comparadorPorOrden(orden))

  const { data: resumenRaw } = await supabase
    .from('rollos')
    .select('kilos, articulos!inner ( nombre ), ingresos!inner ( color )')
    .eq('estado', 'en_stock')

  type ResumenRow = {
    kilos: number | null
    articulos: { nombre: string } | null
    ingresos: { color: string | null } | null
  }
  const resumenRows = (resumenRaw ?? []) as unknown as ResumenRow[]

  const totalKilos = resumenRows.reduce(
    (acc, r) => acc + Number(r.kilos ?? 0),
    0
  )

  const aggMap = new Map<
    string,
    { articulo: string; color: string; kilos: number }
  >()
  for (const r of resumenRows) {
    const articulo = r.articulos?.nombre ?? '-'
    const color = r.ingresos?.color ?? '-'
    const key = `${articulo}|||${color}`
    const prev = aggMap.get(key) ?? { articulo, color, kilos: 0 }
    prev.kilos += Number(r.kilos ?? 0)
    aggMap.set(key, prev)
  }
  const top5 = [...aggMap.values()]
    .sort((a, b) => b.kilos - a.kilos)
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 md:py-8">
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-border sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Inventario
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Stock</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rollos disponibles en depósito, reservas y ubicaciones.
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent text-action">
            <Search className="size-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Total en stock
            </p>
            <Boxes className="size-4 text-action" />
          </div>
          <p className="mt-2 font-heading text-3xl font-bold tabular-nums">
            {totalKilos.toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })}{' '}
            kg
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {resumenRows.length} {resumenRows.length === 1 ? 'rollo' : 'rollos'}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Top 5 articulo + color (kilos)
          </p>
          {top5.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {top5.map((row, i) => (
                <li
                  key={`${row.articulo}-${row.color}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">
                    <span className="font-medium">{row.articulo}</span>
                    <span className="text-muted-foreground"> - {row.color}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {row.kilos.toLocaleString('es-AR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Sin rollos en stock todavía.
            </p>
          )}
        </div>
      </div>

      <StockFilters
        articulos={articulos ?? []}
        tintorerias={tintorerias ?? []}
        colores={colores}
        lotes={lotes}
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

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar el stock: {error.message}
        </div>
      ) : (
        <>
          {sp.lote && rollos.length === 0 && estado !== 'todos' && (
            <LoteSinResultadosBanner
              lote={sp.lote}
              estado={estado}
              searchParams={sp}
            />
          )}
          <StockList rollos={rollos} role={role} />
        </>
      )}
    </div>
  )
}

function comparadorPorOrden(
  orden: string
): (a: StockRollo, b: StockRollo) => number {
  switch (orden) {
    case 'antiguo':
      return (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    case 'kilos_desc':
      return (a, b) => Number(b.kilos ?? 0) - Number(a.kilos ?? 0)
    case 'kilos_asc':
      return (a, b) => Number(a.kilos ?? 0) - Number(b.kilos ?? 0)
    case 'articulo_asc':
      return (a, b) =>
        (a.articulos?.nombre ?? '').localeCompare(
          b.articulos?.nombre ?? '',
          'es',
          { sensitivity: 'base' }
        )
    case 'articulo_desc':
      return (a, b) =>
        (b.articulos?.nombre ?? '').localeCompare(
          a.articulos?.nombre ?? '',
          'es',
          { sensitivity: 'base' }
        )
    case 'reciente':
    default:
      return (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }
}

function LoteSinResultadosBanner({
  lote,
  estado,
  searchParams,
}: {
  lote: string
  estado: string
  searchParams: SearchParams
}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== 'estado') params.set(k, v)
  }
  params.set('estado', 'todos')
  const estadoLabel = ESTADO_LABEL[estado] ?? estado

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
      El lote <span className="font-mono font-medium">{lote} </span>  no tiene
      rollos en estado &ldquo;{estadoLabel}&rdquo;.{' '}
      <Link
        href={`/stock?${params.toString()}`}
        className="underline hover:no-underline font-medium"
      >
        Ver todos los rollos del lote.
      </Link>
    </div>
  )
}
