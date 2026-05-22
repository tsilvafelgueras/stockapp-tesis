import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const ESTADO_INGRESO: Record<string, { text: string; className: string }> = {
  borrador: { text: 'Borrador', className: 'bg-zinc-100 text-zinc-700' },
  auditado: { text: 'Auditado', className: 'bg-warning/15 text-warning' },
  confirmado: { text: 'Confirmado', className: 'bg-success/15 text-success' },
}

const ESTADO_ROLLO: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_stock: { text: 'En stock', className: 'bg-success/15 text-success' },
  reservado: { text: 'Reservado', className: 'bg-primary/15 text-primary' },
  entregado: { text: 'Entregado', className: 'bg-zinc-100 text-zinc-700' },
  baja: { text: 'Baja', className: 'bg-destructive/15 text-destructive' },
  segunda: { text: 'Segunda', className: 'bg-amber-100 text-amber-700' },
}

export default async function IngresoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ creado?: string; editado?: string }>
}) {
  const { id } = await params
  const { creado, editado } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const esAdmin = profile?.role === 'admin'

  const { data: ingreso } = await supabase
    .from('ingresos')
    .select(`
      *,
      tintorerias ( nombre ),
      articulos ( nombre )
    `)
    .eq('id', id)
    .single()

  if (!ingreso) notFound()

  const [{ data: rollos }, { data: demandasCoincidentes }] = await Promise.all([
    supabase
      .from('rollos')
      .select('*')
      .eq('ingreso_id', id)
      .order('numero_pieza', { ascending: true }),
    ingreso.articulo_id
      ? supabase
          .from('pedidos_pendientes')
          .select('id, cliente, color, metros_estimados, kilos_estimados')
          .eq('articulo_id', ingreso.articulo_id)
          .eq('estado', 'activo')
      : Promise.resolve({ data: [] }),
  ])

  const tintoreria = (
    ingreso.tintorerias as unknown as { nombre: string } | null
  )?.nombre
  const articulo = (
    ingreso.articulos as unknown as { nombre: string } | null
  )?.nombre
  const estado = ESTADO_INGRESO[ingreso.estado] ?? ESTADO_INGRESO.borrador

  const totalKilos =
    rollos?.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0) ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {creado === '1' && (
        <div className="rounded-lg border bg-success/10 border-success/30 px-4 py-3 text-sm text-foreground">
          ✓ Ingreso guardado correctamente con {rollos?.length ?? 0} rollo
          {(rollos?.length ?? 0) !== 1 ? 's' : ''}.
        </div>
      )}
      {editado === '1' && (
        <div className="rounded-lg border bg-success/10 border-success/30 px-4 py-3 text-sm text-foreground">
          ✓ Ingreso actualizado correctamente.
        </div>
      )}

      {demandasCoincidentes && demandasCoincidentes.length > 0 && (
        <div className="rounded-lg border bg-warning/10 border-warning/30 px-4 py-3 text-sm space-y-2">
          <p className="font-medium">
            ⚠ {demandasCoincidentes.length === 1
              ? 'Hay 1 demanda pendiente'
              : `Hay ${demandasCoincidentes.length} demandas pendientes`} para este artículo
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {demandasCoincidentes.map((d) => (
              <li key={d.id}>
                <strong>{d.cliente}</strong>
                {d.color ? ` · ${d.color}` : ''}
                {d.metros_estimados ? ` · ${d.metros_estimados} m` : ''}
                {d.kilos_estimados ? ` · ${d.kilos_estimados} kg` : ''}
              </li>
            ))}
          </ul>
          <a
            href="/pedidos-pendientes"
            className="inline-block text-xs underline hover:no-underline mt-1"
          >
            Ver demandas pendientes →
          </a>
        </div>
      )}

      <div>
        <BackButton href="/ingresos" label="Volver a ingresos" />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">
              Ingreso del {ingreso.fecha_despacho}
            </h1>
            <span
              className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
            >
              {estado.text}
            </span>
          </div>
          {esAdmin && (
            <Link
              href={`/ingresos/${id}/editar`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors"
            >
              Editar
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Field label="Tintorería" value={tintoreria ?? '—'} />
        <Field label="Artículo" value={articulo ?? '—'} />
        <Field label="Color" value={ingreso.color ?? '—'} />
        <Field label="Número de remito" value={ingreso.numero_remito ?? '—'} />
        <Field
          label="Total declarado"
          value={`${ingreso.total_rollos_declarado ?? '—'} rollos / ${
            ingreso.total_kilos_declarado ?? '—'
          } kg`}
        />
        {ingreso.ot && <Field label="OT" value={ingreso.ot} />}
        {ingreso.rem_tejeduria && (
          <Field label="Rem. tejeduría" value={ingreso.rem_tejeduria} />
        )}
        {ingreso.referencia && (
          <Field label="Referencia" value={ingreso.referencia} />
        )}
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            Rollos cargados ({rollos?.length ?? 0})
          </h2>
          <span className="text-xs text-muted-foreground">
            Suma kilos: {totalKilos.toFixed(2)} kg
          </span>
        </div>

        {/* Mobile: cards apilados */}
        <div className="sm:hidden divide-y">
          {rollos && rollos.length > 0 ? (
            rollos.map((r) => {
              const e = ESTADO_ROLLO[r.estado] ?? ESTADO_ROLLO.pendiente
              return (
                <div key={r.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{r.numero_pieza}</p>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${e.className}`}
                    >
                      {e.text}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{r.kilos ?? '—'} kg</span>
                    <span>{r.metros ?? '—'} m</span>
                    <span>Ratio: {r.ratio_rendimiento ?? '—'}</span>
                    <span>Ubic: {r.ubicacion ?? '—'}</span>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin rollos cargados.
            </p>
          )}
        </div>

        {/* Desktop: tabla */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">N° Pieza</th>
                <th className="px-4 py-2 font-medium">Kilos</th>
                <th className="px-4 py-2 font-medium">Metros</th>
                <th className="px-4 py-2 font-medium">Ratio</th>
                <th className="px-4 py-2 font-medium">Gramaje</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rollos && rollos.length > 0 ? (
                rollos.map((r) => {
                  const e = ESTADO_ROLLO[r.estado] ?? ESTADO_ROLLO.pendiente
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{r.numero_pieza}</td>
                      <td className="px-4 py-2">{r.kilos ?? '—'}</td>
                      <td className="px-4 py-2">{r.metros ?? '—'}</td>
                      <td className="px-4 py-2">{r.ratio_rendimiento ?? '—'}</td>
                      <td className="px-4 py-2">
                        {r.gramaje_planilla ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.ubicacion ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${e.className}`}
                        >
                          {e.text}
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
                    Sin rollos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}
