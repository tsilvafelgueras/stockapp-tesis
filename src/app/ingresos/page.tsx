import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardBackButton from '@/components/DashboardBackButton'
import RollosBulkView, { type RolloBulk } from './RollosBulkView'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  borrador: { text: 'Borrador', className: 'bg-zinc-100 text-zinc-700' },
  auditado: { text: 'Auditado', className: 'bg-warning/15 text-warning' },
  confirmado: { text: 'Confirmado', className: 'bg-success/15 text-success' },
}

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
      fecha_despacho,
      numero_remito,
      estado,
      tintorerias ( nombre ),
      articulos ( nombre ),
      rollos ( kilos )
    `)
    .order('fecha_despacho', { ascending: false })

  return (
    <>
      {/* Vista mobile: cards apilados */}
      <div className="sm:hidden space-y-3">
        {ingresos && ingresos.length > 0 ? (
          ingresos.map((d) => {
            const estado = ESTADO_LABEL[d.estado] ?? ESTADO_LABEL.borrador
            const tintoreria = (
              d.tintorerias as unknown as { nombre: string } | null
            )?.nombre
            const articulo = (
              d.articulos as unknown as { nombre: string } | null
            )?.nombre
            const rollosArr =
              (d.rollos as unknown as { kilos: number | null }[] | null) ?? []
            const cantidadRollos = rollosArr.length
            const sumaKilos = rollosArr.reduce(
              (acc, r) => acc + Number(r.kilos ?? 0),
              0
            )
            return (
              <Link
                key={d.id}
                href={`/ingresos/${d.id}`}
                className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{d.fecha_despacho}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {tintoreria ?? '—'} · {articulo ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                  >
                    {estado.text}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>
                    {cantidadRollos} {cantidadRollos === 1 ? 'rollo' : 'rollos'}
                  </span>
                  {sumaKilos > 0 && <span>{sumaKilos.toFixed(2)} kg</span>}
                  {d.numero_remito && <span>Rem: {d.numero_remito}</span>}
                </div>
              </Link>
            )
          })
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Todavía no cargaste ningún ingreso.
          </div>
        )}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tintorería</th>
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Remito</th>
                <th className="px-4 py-3 font-medium">Rollos</th>
                <th className="px-4 py-3 font-medium">Kilos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ingresos && ingresos.length > 0 ? (
                ingresos.map((d) => {
                  const estado = ESTADO_LABEL[d.estado] ?? ESTADO_LABEL.borrador
                  const tintoreria = (
                    d.tintorerias as unknown as { nombre: string } | null
                  )?.nombre
                  const articulo = (
                    d.articulos as unknown as { nombre: string } | null
                  )?.nombre
                  const rollosArr =
                    (d.rollos as unknown as
                      | { kilos: number | null }[]
                      | null) ?? []
                  const cantidadRollos = rollosArr.length
                  const sumaKilos = rollosArr.reduce(
                    (acc, r) => acc + Number(r.kilos ?? 0),
                    0
                  )
                  return (
                    <tr
                      key={d.id}
                      className="border-b last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/ingresos/${d.id}`}
                          className="font-medium hover:underline"
                        >
                          {d.fecha_despacho}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{tintoreria ?? '—'}</td>
                      <td className="px-4 py-3">{articulo ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.numero_remito ?? '—'}
                      </td>
                      <td className="px-4 py-3">{cantidadRollos}</td>
                      <td className="px-4 py-3">
                        {sumaKilos > 0 ? `${sumaKilos.toFixed(2)} kg` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                        >
                          {estado.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavía no cargaste ningún ingreso.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

async function RollosBulkLoader({ role }: { role: 'operario' | 'admin' }) {
  const supabase = await createClient()

  const [{ data: rollosRaw }, { data: articulos }] = await Promise.all([
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
          articulos ( nombre ),
          ingreso_id,
          ingresos!inner (
            id,
            fecha_despacho,
            numero_remito,
            color,
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
  ])

  type Row = {
    id: string
    numero_pieza: string
    kilos: number | null
    metros: number | null
    ubicacion: string | null
    estado: string
    articulo_id: string | null
    articulos: { nombre: string } | null
    ingreso_id: string
    ingresos: {
      fecha_despacho: string | null
      numero_remito: string | null
      color: string | null
      ot: string | null
      rem_tejeduria: string | null
      referencia: string | null
      tintoreria_id: string | null
      tintorerias: { nombre: string } | null
    } | null
  }

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
      ingreso_id: r.ingreso_id,
      ingreso_fecha: r.ingresos?.fecha_despacho ?? null,
      ingreso_remito: r.ingresos?.numero_remito ?? null,
      ingreso_color: r.ingresos?.color ?? null,
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
      role={role}
    />
  )
}
