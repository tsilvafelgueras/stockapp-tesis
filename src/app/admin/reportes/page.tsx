import { createClient } from '@/lib/supabase/server'
import {
  reporteStock,
  reporteMovimientos,
  reporteDiferencias,
  reporteAntiguedad,
  type StockRow,
  type MovimientosResult,
  type DiferenciaRow,
  type AntiguedadRow,
} from './queries'

type SearchParams = {
  dias?: string
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const dias = Number(sp.dias) > 0 ? Number(sp.dias) : 30

  const supabase = await createClient()

  // Las 4 queries en paralelo
  const [stock, movimientos, diferencias, antiguedad] = await Promise.all([
    reporteStock(supabase),
    reporteMovimientos(supabase),
    reporteDiferencias(supabase),
    reporteAntiguedad(supabase, dias),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Estado del stock, movimientos del mes y diferencias
        </p>
      </div>

      <SeccionStock data={stock} />
      <SeccionMovimientos data={movimientos} />
      <SeccionDiferencias data={diferencias} />
      <SeccionAntiguedad data={antiguedad} dias={dias} />
    </div>
  )
}

// ── Secciones ─────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  csvHref,
}: {
  title: string
  description?: string
  csvHref: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <a
        href={csvHref}
        className="text-xs rounded-md border bg-white px-3 py-1.5 hover:bg-zinc-50 transition-colors self-start"
        download
      >
        ↓ Exportar CSV
      </a>
    </div>
  )
}

function SeccionStock({ data }: { data: StockRow[] }) {
  const totalRollos = data.reduce((acc, r) => acc + r.rollos, 0)
  const totalKilos = data.reduce((acc, r) => acc + r.kilos, 0)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Stock por artículo y color"
        description="Rollos en estado en_stock agrupados por artículo+color"
        csvHref="/admin/reportes/csv?tipo=stock"
      />
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Color</th>
                <th className="px-4 py-3 font-medium text-right">Rollos</th>
                <th className="px-4 py-3 font-medium text-right">Kilos</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Sin datos.
                  </td>
                </tr>
              ) : (
                data.map((r, i) => (
                  <tr
                    key={`${r.articulo}-${r.color}-${i}`}
                    className="border-b last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">{r.articulo}</td>
                    <td className="px-4 py-2">{r.color}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.rollos}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.kilos.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-zinc-50 border-t">
                <tr>
                  <td className="px-4 py-2 font-semibold" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {totalRollos}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {totalKilos.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  )
}

function SeccionMovimientos({ data }: { data: MovimientosResult }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Movimientos del mes"
        description={`Ingresos creados y pedidos entregados durante ${data.mes}`}
        csvHref="/admin/reportes/csv?tipo=movimientos"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Ingresos del mes
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {data.ingresosRollos}{' '}
            <span className="text-base font-normal text-muted-foreground">
              rollos
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-1 tabular-nums">
            {data.ingresosKilos.toFixed(2)} kg
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Rollos creados este mes (independiente del estado actual)
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Egresos del mes
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {data.egresosRollos}{' '}
            <span className="text-base font-normal text-muted-foreground">
              rollos
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-1 tabular-nums">
            {data.egresosKilos.toFixed(2)} kg
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {data.pedidosEntregados} pedidos entregados este mes
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Aclaración:</strong> sin un timestamp explícito de
        &ldquo;cuándo entró al stock&rdquo; en cada rollo, ingresos del mes se
        calcula sobre <code>rollos.created_at</code>. Egresos se calcula sobre
        pedidos en estado <code>entregada</code> creados en el mes (proxy
        consistente con los datos disponibles).
      </p>
    </section>
  )
}

function SeccionDiferencias({ data }: { data: DiferenciaRow[] }) {
  const totalDifKilos = data.reduce((acc, r) => acc + r.dif_kilos, 0)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Diferencias proveedor vs propio"
        description="Rollos con kilos_propios cargados (control de calidad)"
        csvHref="/admin/reportes/csv?tipo=diferencias"
      />
      {data.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Todavía no hay rollos con datos propios cargados. Cuando el operario
          mida y registre <code>kilos_propios</code>, las diferencias aparecen
          acá.
        </div>
      ) : (
        <>
          <p className="text-sm">
            Diferencia total acumulada:{' '}
            <strong
              className={
                totalDifKilos < 0 ? 'text-destructive' : 'text-success'
              }
            >
              {totalDifKilos > 0 ? '+' : ''}
              {totalDifKilos.toFixed(2)} kg
            </strong>{' '}
            <span className="text-xs text-muted-foreground">
              (positivo = recibimos más de lo que decía la planilla)
            </span>
          </p>
          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Pieza</th>
                    <th className="px-4 py-3 font-medium">Artículo</th>
                    <th className="px-4 py-3 font-medium">Color</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Kg planilla
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Kg propios
                    </th>
                    <th className="px-4 py-3 font-medium text-right">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{r.numero_pieza}</td>
                      <td className="px-4 py-2">{r.articulo}</td>
                      <td className="px-4 py-2">{r.color}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.kilos.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.kilos_propios.toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-medium ${
                          r.dif_kilos < 0
                            ? 'text-destructive'
                            : 'text-success'
                        }`}
                      >
                        {r.dif_kilos > 0 ? '+' : ''}
                        {r.dif_kilos.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > 100 && (
              <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-zinc-50">
                Mostrando 100 de {data.length}. Exportá a CSV para verlos
                todos.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function SeccionAntiguedad({
  data,
  dias,
}: {
  data: AntiguedadRow[]
  dias: number
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title={`Antigüedad de stock (>${dias} días sin moverse)`}
        description="Rollos en stock que entraron hace más del umbral. Cambiá el umbral con ?dias=N"
        csvHref={`/admin/reportes/csv?tipo=antiguedad&dias=${dias}`}
      />

      <form className="flex items-center gap-2 text-sm">
        <label className="text-muted-foreground">Días de antigüedad:</label>
        <select
          name="dias"
          defaultValue={dias}
          className="rounded-md border px-2 py-1 text-sm bg-white"
        >
          {[7, 15, 30, 60, 90, 180].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
        >
          Aplicar
        </button>
      </form>

      {data.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Sin rollos con más de {dias} días en stock.
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Pieza</th>
                  <th className="px-4 py-3 font-medium">Artículo</th>
                  <th className="px-4 py-3 font-medium">Color</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Ingresó</th>
                  <th className="px-4 py-3 font-medium text-right">Kilos</th>
                  <th className="px-4 py-3 font-medium text-right">Días</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{r.numero_pieza}</td>
                    <td className="px-4 py-2">{r.articulo}</td>
                    <td className="px-4 py-2">{r.color}</td>
                    <td className="px-4 py-2">{r.ubicacion}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.kilos.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-warning">
                      {r.dias}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 100 && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-zinc-50">
              Mostrando 100 de {data.length}. Exportá a CSV para verlos todos.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
