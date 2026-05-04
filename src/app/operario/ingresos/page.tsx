import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  borrador: { text: 'Borrador', className: 'bg-zinc-100 text-zinc-700' },
  auditado: { text: 'Auditado', className: 'bg-warning/15 text-warning' },
  confirmado: { text: 'Confirmado', className: 'bg-success/15 text-success' },
}

export default async function IngresosPage() {
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Llegadas de mercadería desde tintorerías
          </p>
        </div>
        <Link
          href="/operario/ingresos/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center sm:text-left"
        >
          + Nuevo ingreso
        </Link>
      </div>

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
                href={`/operario/ingresos/${d.id}`}
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
                          href={`/operario/ingresos/${d.id}`}
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
    </div>
  )
}
