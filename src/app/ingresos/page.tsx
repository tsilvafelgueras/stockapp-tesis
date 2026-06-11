import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardBackButton from '@/components/DashboardBackButton'
import { getUbicacionesActivas } from '@/lib/ubicacionesServer'
import RollosBulkView, { type RolloBulk } from './RollosBulkView'
import IngresosListClient, { type IngresoRow } from './IngresosListClient'

type SearchParams = { vista?: 'ingresos' | 'rollos' }

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const sp = await searchParams
  const vista = sp.vista === 'rollos' ? 'rollos' : 'ingresos'

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const role = profile?.role === 'admin' ? 'admin' : 'operario'

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Llegadas de mercadería desde tintorerías
          </p>
        </div>
        <Link
          href="/ingresos/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center sm:text-left"
        >
          + Nuevo ingreso
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-2 -mb-px">
          <Link
            href="/ingresos?vista=ingresos"
            data-ripple
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              vista === 'ingresos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Por ingreso
          </Link>
          <Link
            href="/ingresos?vista=rollos"
            data-ripple
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              vista === 'rollos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Por rollo (filtros + edición masiva)
          </Link>
        </nav>
      </div>

      {vista === 'ingresos' ? (
        <IngresosListView />
      ) : (
        <RollosBulkLoader role={role} />
      )}
    </div>
  )
}

async function IngresosListView() {
  const supabase = await createClient()

  const { data: ingresos } = await supabase
    .from('ingresos')
    .select(`
      id,
      numero_lote,
      fecha_despacho,
      numero_remito,
      ot,
      referencia,
      rem_tejeduria,
      estado,
      tintorerias ( nombre ),
      rollos ( kilos, articulos ( nombre ) )
    `)
    .order('fecha_despacho', { ascending: false })

  const rows: IngresoRow[] = (ingresos ?? []).map((d) => {
    const rollosArr =
      (d.rollos as unknown as
        | { kilos: number | null; articulos: { nombre: string } | null }[]
        | null) ?? []
    const articulosResumen = Array.from(
      new Set(
        rollosArr
          .map((r) => r.articulos?.nombre)
          .filter((n): n is string => Boolean(n))
      )
    ).join(', ')
    return {
      id: d.id,
      numero_lote: d.numero_lote ?? null,
      fecha_despacho: d.fecha_despacho ?? null,
      numero_remito: d.numero_remito ?? null,
      ot: d.ot ?? null,
      referencia: d.referencia ?? null,
      rem_tejeduria: d.rem_tejeduria ?? null,
      estado: d.estado,
      tintoreria: (d.tintorerias as unknown as { nombre: string } | null)?.nombre ?? null,
      cantidadRollos: rollosArr.length,
      sumaKilos: rollosArr.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0),
      articulosResumen,
    }
  })

  return <IngresosListClient ingresos={rows} />
}

async function RollosBulkLoader({ role }: { role: 'operario' | 'admin' }) {
  const supabase = await createClient()

  const [
    { data: rollosRaw },
    { data: articulos },
    { data: colores },
    ubicaciones,
  ] = await Promise.all([
    supabase
      .from('rollos')
      .select(
        `
          id,
          numero_pieza,
          kilos,
          metros,
          ubicacion,
          estado,
          articulo_id,
          color_id,
          articulos ( nombre ),
          ingreso_id,
          ingresos!inner (
            id,
            fecha_despacho,
            numero_remito,
            ot,
            rem_tejeduria,
            referencia,
            tintoreria_id,
            tintorerias ( nombre )
          )
        `
      )
      .order('created_at', { ascending: false })
      .limit(2000),
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
    getUbicacionesActivas(supabase),
  ])

  type Row = {
    id: string
    numero_pieza: string
    kilos: number | null
    metros: number | null
    ubicacion: string | null
    estado: string
    articulo_id: string | null
    color_id: string | null
    articulos: { nombre: string } | null
    ingreso_id: string
    ingresos: {
      fecha_despacho: string | null
      numero_remito: string | null
      ot: string | null
      rem_tejeduria: string | null
      referencia: string | null
      tintoreria_id: string | null
      tintorerias: { nombre: string } | null
    } | null
  }

  const colorById = new Map((colores ?? []).map((c) => [c.id, c.nombre]))

  const rollos: RolloBulk[] = ((rollosRaw ?? []) as unknown as Row[]).map(
    (r) => ({
      id: r.id,
      numero_pieza: r.numero_pieza,
      kilos: r.kilos,
      metros: r.metros,
      ubicacion: r.ubicacion,
      estado: r.estado,
      articulo_id: r.articulo_id,
      articulo_nombre: r.articulos?.nombre ?? null,
      color_id: r.color_id,
      color_nombre: r.color_id ? colorById.get(r.color_id) ?? null : null,
      ingreso_id: r.ingreso_id,
      ingreso_fecha: r.ingresos?.fecha_despacho ?? null,
      ingreso_remito: r.ingresos?.numero_remito ?? null,
      ingreso_ot: r.ingresos?.ot ?? null,
      ingreso_rem_tejeduria: r.ingresos?.rem_tejeduria ?? null,
      ingreso_referencia: r.ingresos?.referencia ?? null,
      tintoreria_id: r.ingresos?.tintoreria_id ?? null,
      tintoreria_nombre: r.ingresos?.tintorerias?.nombre ?? null,
    })
  )

  return (
    <RollosBulkView
      rollos={rollos}
      articulos={articulos ?? []}
      colores={colores ?? []}
      ubicaciones={ubicaciones}
      role={role}
    />
  )
}
