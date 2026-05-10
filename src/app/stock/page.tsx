import { createClient } from '@/lib/supabase/server'
import StockFilters from './StockFilters'
import StockList, { type StockRollo, type StockRole } from './StockList'

type SearchParams = {
  q?: string
  articulo?: string
  color?: string
  tintoreria?: string
  ubicacion?: string
  estado?: string
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'ventas') as StockRole

  // Catálogos para los dropdowns (solo activos)
  const [{ data: articulos }, { data: tintorerias }] = await Promise.all([
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
  ])

  // Query principal con joins. !inner sobre ingresos para poder filtrar por
  // tintoreria_id y color del ingreso.
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
        created_at,
        articulos ( id, nombre ),
        ingresos!inner (
          id,
          fecha_despacho,
          numero_remito,
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
  if (sp.tintoreria)
    query = query.eq('ingresos.tintoreria_id', sp.tintoreria)
  if (sp.q) query = query.ilike('numero_pieza', `%${sp.q.trim()}%`)
  if (sp.ubicacion)
    query = query.ilike('ubicacion', `%${sp.ubicacion.trim()}%`)
  if (sp.color)
    query = query.ilike('ingresos.color', `%${sp.color.trim()}%`)

  const { data: rollosRaw, error } = await query
  const rollos = (rollosRaw ?? []) as unknown as StockRollo[]

  // Resumen agregado: SIEMPRE sobre todo el en_stock (no respeta filtros).
  // Es la métrica de "qué tengo en depósito ahora", no del subset filtrado.
  const { data: resumenRaw } = await supabase
    .from('rollos')
    .select(
      'kilos, articulos!inner ( nombre ), ingresos!inner ( color )'
    )
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
    const articulo = r.articulos?.nombre ?? '—'
    const color = r.ingresos?.color ?? '—'
    const key = `${articulo}|||${color}`
    const prev = aggMap.get(key) ?? { articulo, color, kilos: 0 }
    prev.kilos += Number(r.kilos ?? 0)
    aggMap.set(key, prev)
  }
  const top5 = [...aggMap.values()]
    .sort((a, b) => b.kilos - a.kilos)
    .slice(0, 5)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Rollos disponibles en depósito
        </p>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Total en stock
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {totalKilos.toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })}{' '}
            kg
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {resumenRows.length}{' '}
            {resumenRows.length === 1 ? 'rollo' : 'rollos'}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Top 5 artículo + color (kilos)
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
                    <span className="text-muted-foreground">
                      {' · '}
                      {row.color}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {row.kilos.toLocaleString('es-AR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Sin rollos en stock todavía.
            </p>
          )}
        </div>
      </div>

      <StockFilters
        articulos={articulos ?? []}
        tintorerias={tintorerias ?? []}
        current={{
          q: sp.q ?? '',
          articulo: sp.articulo ?? '',
          color: sp.color ?? '',
          tintoreria: sp.tintoreria ?? '',
          ubicacion: sp.ubicacion ?? '',
          estado,
        }}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar el stock: {error.message}
        </div>
      ) : (
        <StockList rollos={rollos} role={role} />
      )}
    </div>
  )
}
