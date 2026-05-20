import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import {
  reporteStock,
  reporteMovimientos,
  reporteDiferencias,
  reporteAntiguedad,
  reporteMerma,
  reporteTintorerias,
  type StockRow,
  type MovimientosResult,
  type DiferenciaRow,
  type AntiguedadRow,
  type MermaResult,
  type PedidosTintoreriaRow,
  type ReportesFilters as ReportesFiltersType,
} from './queries'
import ReportesFilters from './ReportesFilters'

type SearchParams = {
  dias?: string
  anio?: string
  mes?: string
  tintoreria?: string
  articulo?: string
}

function splitParam(value?: string): string[] {
  return value?.split(',').map((v) => v.trim()).filter(Boolean) ?? []
}

function buildCsvHref(
  tipo: string,
  filters: ReportesFiltersType,
  extra?: Record<string, string | number>
): string {
  const sp = new URLSearchParams({ tipo })
  const tintorerias = filters.tintoreriaIds?.length
    ? filters.tintoreriaIds
    : filters.tintoreriaId
      ? [filters.tintoreriaId]
      : []
  const articulos = filters.articuloIds?.length
    ? filters.articuloIds
    : filters.articuloId
      ? [filters.articuloId]
      : []
  const meses = filters.meses?.length ? filters.meses : filters.mes ? [filters.mes] : []
  if (tintorerias.length) sp.set('tintoreria', tintorerias.join(','))
  if (articulos.length) sp.set('articulo', articulos.join(','))
  if (filters.anio) sp.set('anio', String(filters.anio))
  if (meses.length) sp.set('mes', meses.join(','))
  if (extra) {
    for (const [k, v] of Object.entries(extra)) sp.set(k, String(v))
  }
  return `/admin/reportes/csv?${sp.toString()}`
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const dias = Number(sp.dias) > 0 ? Number(sp.dias) : 30
  const anioActual = new Date().getFullYear()
  const meses = splitParam(sp.mes)
    .map(Number)
    .filter((n) => n >= 1 && n <= 12)
  const tintoreriaIds = splitParam(sp.tintoreria)
  const articuloIds = splitParam(sp.articulo)

  const filters: ReportesFiltersType = {
    tintoreriaIds,
    articuloIds,
    anio: sp.anio ? Number(sp.anio) : anioActual,
    meses,
  }

  const supabase = await createClient()

  // Catálogos para filtros + queries de reporte, en paralelo
  const [
    stock,
    movimientos,
    diferencias,
    antiguedad,
    merma,
    pedidosTintoreria,
    { data: tintorerias },
    { data: articulos },
    { data: aniosRollos },
  ] = await Promise.all([
    reporteStock(supabase, filters),
    reporteMovimientos(supabase, filters),
    reporteDiferencias(supabase, filters),
    reporteAntiguedad(supabase, dias, filters),
    reporteMerma(supabase, filters),
    reporteTintorerias(supabase, filters),
    supabase
      .from('tintorerias')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('articulos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('rollos').select('created_at').limit(2000),
  ])

  const aniosSet = new Set<number>()
  for (const r of aniosRollos ?? []) {
    if (r.created_at) aniosSet.add(new Date(r.created_at).getFullYear())
  }
  const anios = [...aniosSet]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <BackButton href="/admin/dashboard" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Estado del stock, movimientos del mes y diferencias
        </p>
      </div>

      <ReportesFilters
        current={{
          anio: sp.anio ?? String(anioActual),
          meses: splitParam(sp.mes),
          tintorerias: tintoreriaIds,
          articulos: articuloIds,
          dias: sp.dias ?? '30',
        }}
        tintorerias={tintorerias ?? []}
        articulos={articulos ?? []}
        anios={anios}
      />

      <SeccionStock
        data={stock}
        csvHref={buildCsvHref('stock', filters)}
      />
      <SeccionMovimientos
        data={movimientos}
        csvHref={buildCsvHref('movimientos', filters)}
      />
      <SeccionTintorerias
        data={pedidosTintoreria}
        csvHref={buildCsvHref('tintorerias', filters)}
      />
      <SeccionMerma
        data={merma}
        csvHref={buildCsvHref('merma', filters)}
      />
      <SeccionDiferencias
        data={diferencias}
        csvHref={buildCsvHref('diferencias', filters)}
      />
      <SeccionAntiguedad
        data={antiguedad}
        dias={dias}
        csvHref={buildCsvHref('antiguedad', filters, { dias })}
      />
    </div>
  )
}

function SeccionTintorerias({
  data,
  csvHref,
}: {
  data: PedidosTintoreriaRow[]
  csvHref: string
}) {
  const totalPedidos = data.reduce((s, r) => s + r.pedidos, 0)
  const totalRollos = data.reduce((s, r) => s + r.rollos, 0)
  const totalKilos = data.reduce((s, r) => s + r.kilos, 0)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Pedidos por tintorería"
        description="Cruce de pedidos con la tintorería de origen de los rollos vendidos. Útil para análisis de proveedores."
        csvHref={csvHref}
      />
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Tintorería</th>
                <th className="px-4 py-3 font-medium text-right">Pedidos</th>
                <th className="px-4 py-3 font-medium text-right">Entregados</th>
                <th className="px-4 py-3 font-medium text-right">En curso</th>
                <th className="px-4 py-3 font-medium text-right">Cancelados</th>
                <th className="px-4 py-3 font-medium text-right">Rollos</th>
                <th className="px-4 py-3 font-medium text-right">Kilos</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin pedidos con rollos de tintorerías en este período.
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr
                    key={r.tintoreria_id ?? 'sin'}
                    className="border-b last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">{r.tintoreria}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.pedidos}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-success">
                      {r.entregados}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.en_curso}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-destructive">
                      {r.cancelados}
                    </td>
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
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {totalPedidos}
                  </td>
                  <td colSpan={3}></td>
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

function SeccionStock({ data, csvHref }: { data: StockRow[]; csvHref: string }) {
  const totalRollos = data.reduce((acc, r) => acc + r.rollos, 0)
  const totalKilos = data.reduce((acc, r) => acc + r.kilos, 0)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Stock por artículo y color"
        description="Rollos disponibles en depósito, agrupados por artículo y color"
        csvHref={csvHref}
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

function SeccionMovimientos({
  data,
  csvHref,
}: {
  data: MovimientosResult
  csvHref: string
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Movimientos"
        description={`Ingresos creados y pedidos entregados durante ${data.mes}`}
        csvHref={csvHref}
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
        <strong>Aclaración:</strong> sin un campo de fecha de entrada al stock
        en cada rollo, los ingresos del mes se calculan sobre la fecha de
        creación del rollo en el sistema. Los egresos se calculan sobre pedidos
        en estado &ldquo;Entregada&rdquo; creados en el mes (aproximación
        consistente con los datos disponibles).
      </p>
    </section>
  )
}

function SeccionMerma({
  data,
  csvHref,
}: {
  data: MermaResult
  csvHref: string
}) {
  if (data.rows.length === 0) {
    return (
      <section className="space-y-3">
        <SectionHeader
          title="Merma por artículo y color"
          description="Diferencia entre kilos de planilla y kilos propios medidos"
          csvHref={csvHref}
        />
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Sin datos de merma todavía. Cuando los operarios carguen el peso propio
          de los rollos, la merma aparecerá acá.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Merma por artículo y color"
        description="Diferencia entre kilos de planilla y kilos propios medidos"
        csvHref={csvHref}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Merma total
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {data.total_merma_kg.toFixed(2)}{' '}
            <span className="text-base font-normal text-muted-foreground">kg</span>
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Merma promedio
          </p>
          <p
            className={`text-2xl font-bold mt-1 tabular-nums ${
              data.total_merma_pct > 5
                ? 'text-destructive'
                : data.total_merma_pct > 2
                  ? 'text-warning'
                  : 'text-success'
            }`}
          >
            {data.total_merma_pct.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            sobre {data.total_kilos_planilla.toFixed(2)} kg de planilla
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Rollos medidos
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {data.rows.reduce((s, r) => s + r.rollos_con_medicion, 0)}
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Color</th>
                <th className="px-4 py-3 font-medium text-right">Kg planilla</th>
                <th className="px-4 py-3 font-medium text-right">Kg propios</th>
                <th className="px-4 py-3 font-medium text-right">Merma kg</th>
                <th className="px-4 py-3 font-medium text-right">Merma %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr
                  key={`${r.articulo}-${r.color}-${i}`}
                  className="border-b last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{r.articulo}</td>
                  <td className="px-4 py-2">{r.color}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.kilos_planilla.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.kilos_propios.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {r.merma_kg.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums font-medium ${
                      r.merma_pct > 5
                        ? 'text-destructive'
                        : r.merma_pct > 2
                          ? 'text-warning'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {r.merma_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 border-t">
              <tr>
                <td className="px-4 py-2 font-semibold" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {data.total_kilos_planilla.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {data.total_kilos_propios.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {data.total_merma_kg.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {data.total_merma_pct.toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  )
}

function SeccionDiferencias({
  data,
  csvHref,
}: {
  data: DiferenciaRow[]
  csvHref: string
}) {
  const totalDifKilos = data.reduce((acc, r) => acc + r.dif_kilos, 0)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Diferencias proveedor vs propio"
        description="Rollos con kilos_propios cargados (control de calidad)"
        csvHref={csvHref}
      />
      {data.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Todavía no hay rollos con peso propio registrado. Cuando el operario
          mida y cargue el peso real del rollo, las diferencias aparecen acá.
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
  csvHref,
}: {
  data: AntiguedadRow[]
  dias: number
  csvHref: string
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title={`Días en mano (>${dias} días sin moverse)`}
        description="El umbral se cambia desde el filtro de arriba"
        csvHref={csvHref}
      />

      {data.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Sin rollos con más de {dias} días en mano.
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
                  <th className="px-4 py-3 font-medium text-right">Días en mano</th>
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
