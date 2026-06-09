import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardBackButton from '@/components/DashboardBackButton'

export default async function ConfirmarPage() {
  const supabase = await createClient()

  // Ingresos que tienen al menos un rollo pendiente
  const { data: rollosPendientes } = await supabase
    .from('rollos')
    .select('ingreso_id')
    .eq('estado', 'pendiente')

  const ingresoIds = [
    ...new Set((rollosPendientes ?? []).map((r) => r.ingreso_id as string)),
  ]

  // Nota: `colores ( nombre )` anidado dentro de `rollos` no resuelve
  // la relación en PostgREST y rompe toda la query. Se obtiene color_id
  // de los rollos y se resuelven los nombres con una query aparte.
  const ingresosRaw =
    ingresoIds.length > 0
      ? await supabase
          .from('ingresos')
          .select(`
            id, fecha_despacho, numero_remito, total_rollos_declarado, ot,
            tintorerias ( nombre ),
            articulos ( nombre ),
            rollos ( id, estado, color_id )
          `)
          .in('id', ingresoIds)
          .order('fecha_despacho', { ascending: false })
          .then((r) => r.data)
      : []

  // Resolver nombres de colores en batch
  const allColorIds = [
    ...new Set(
      (ingresosRaw ?? []).flatMap((ing) =>
        ((ing.rollos as unknown as { color_id: string | null }[] | null) ?? [])
          .map((r) => r.color_id)
          .filter((cid): cid is string => Boolean(cid))
      )
    ),
  ]
  const colorById = new Map<string, string>()
  if (allColorIds.length > 0) {
    const { data: coloresData } = await supabase
      .from('colores')
      .select('id, nombre')
      .in('id', allColorIds)
    ;(coloresData ?? []).forEach((c) =>
      colorById.set(c.id as string, c.nombre as string)
    )
  }

  const ingresos = ingresosRaw

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Confirmar llegadas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contá los rollos de cada partida y confirmá la llegada al depósito
        </p>
      </div>

      {!ingresos || ingresos.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center space-y-2 shadow-sm">
          <p className="text-2xl">✓</p>
          <p className="font-medium">Todo al día</p>
          <p className="text-sm text-muted-foreground">
            No hay ingresos con rollos pendientes de confirmación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ingresos.map((ingreso) => {
            const tintoreria = (
              ingreso.tintorerias as unknown as { nombre: string } | null
            )?.nombre
            const articulo = (
              ingreso.articulos as unknown as { nombre: string } | null
            )?.nombre
            const rollosArr =
              (ingreso.rollos as unknown as {
                id: string
                estado: string
                color_id: string | null
              }[] | null) ?? []
            const pendientes = rollosArr.filter((r) => r.estado === 'pendiente').length
            const total = rollosArr.length

            // Obtener color del primer rollo que lo tenga
            const colorNombre = rollosArr
              .map((r) => (r.color_id ? colorById.get(r.color_id) : undefined))
              .find((c): c is string => Boolean(c))

            return (
              <Link
                key={ingreso.id}
                href={`/confirmar/${ingreso.id}`}
                className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{tintoreria ?? '—'}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {ingreso.fecha_despacho}
                      {ingreso.numero_remito ? ` · Rem. ${ingreso.numero_remito}` : ''}
                    </p>
                    {(articulo || colorNombre) && (
                      <p className="text-xs text-muted-foreground">
                        {[articulo, colorNombre].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {(ingreso as unknown as { ot: string | null }).ot && (
                      <p className="text-xs text-muted-foreground">
                        OT {(ingreso as unknown as { ot: string | null }).ot}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-warning">
                      {pendientes}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{total} pendientes
                    </span>
                  </div>
                </div>

                {/* Mini barra de progreso */}
                <div className="mt-3 w-full bg-zinc-100 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{
                      width: total > 0 ? `${Math.round(((total - pendientes) / total) * 100)}%` : '0%',
                    }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
