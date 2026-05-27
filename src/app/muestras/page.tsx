import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardBackButton from '@/components/DashboardBackButton'

export default async function MuestrasListPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('muestras')
    .select(
      `
        id,
        cliente,
        kilos_descontados,
        motivo,
        created_at,
        rollos ( numero_pieza, articulos ( nombre ), colores ( nombre ) )
      `
    )
    .order('created_at', { ascending: false })
    .limit(200)

  type Row = {
    id: string
    cliente: string
    kilos_descontados: number
    motivo: string | null
    created_at: string
    rollos: {
      numero_pieza: string
      articulos: { nombre: string } | null
      colores: { nombre: string } | null
    } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const totalKilosMes = rows
    .filter((r) => {
      const d = new Date(r.created_at)
      const now = new Date()
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      )
    })
    .reduce((acc, r) => acc + Number(r.kilos_descontados), 0)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Muestras</h1>
          <p className="text-sm text-muted-foreground">
            Cortes y muestras entregadas a clientes
          </p>
        </div>
        <Link
          href="/muestras/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center"
        >
          + Nueva muestra
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Kilos entregados este mes
        </p>
        <p className="text-2xl font-bold mt-1 tabular-nums">
          {totalKilosMes.toLocaleString('es-AR', {
            maximumFractionDigits: 2,
          })}{' '}
          kg
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {rows.length} {rows.length === 1 ? 'muestra' : 'muestras'} en total
        </p>
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {rows.length > 0 ? (
          rows.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.cliente}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.rollos?.articulos?.nombre ?? '—'}
                    {r.rollos?.colores?.nombre ? ` · ${r.rollos.colores.nombre}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {Number(r.kilos_descontados).toFixed(2)} kg
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>Pieza {r.rollos?.numero_pieza ?? '—'}</span>
                <span>
                  {new Date(r.created_at).toLocaleDateString('es-AR')}
                </span>
              </div>
              {r.motivo && (
                <p className="mt-1 text-xs text-muted-foreground italic truncate">
                  {r.motivo}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Todavía no hay muestras registradas.
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Pieza</th>
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Color</th>
                <th className="px-4 py-3 font-medium">Kilos</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.cliente}</td>
                    <td className="px-4 py-3">
                      {r.rollos?.numero_pieza ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.rollos?.articulos?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.rollos?.colores?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(r.kilos_descontados).toFixed(2)} kg
                    </td>
                    <td className="px-4 py-3 text-muted-foreground italic">
                      {r.motivo ?? '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavía no hay muestras registradas.
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
