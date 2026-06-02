import { Download } from 'lucide-react'
import type {
  MovimientosResult,
  DiferenciaRow,
  MermaResult,
  PedidosTintoreriaRow,
} from '../queries'

// ════════════════════════════════════════════════════════════
//  Secciones heredadas del reporte anterior.
//  Se conservan tal cual mientras el rediseño avanza bloque por
//  bloque; cada una se reemplaza al construir su bloque:
//   - SeccionTintorerias  → Bloque C
//   - SeccionMerma / SeccionDiferencias → Bloque D
//   - SeccionMovimientos  → Bloque E
// ════════════════════════════════════════════════════════════

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
        className="inline-flex items-center gap-1.5 self-start rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
        download
      >
        <Download className="size-3.5" />
        Exportar CSV
      </a>
    </div>
  )
}

export function SeccionTintorerias({
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
            <thead className="bg-muted/40 border-b">
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
              <tfoot className="bg-muted/40 border-t">
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

export function SeccionMovimientos({
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
            Ingresos del período
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
            Rollos creados en el período (independiente del estado actual)
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Egresos del período
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
            {data.pedidosEntregados} pedidos entregados en el período
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Aclaración:</strong> sin un campo de fecha de entrada al stock
        en cada rollo, los ingresos se calculan sobre la fecha de creación del
        rollo en el sistema. Los egresos se calculan sobre pedidos en estado
        &ldquo;Entregada&rdquo; creados en el período (aproximación consistente
        con los datos disponibles).
      </p>
    </section>
  )
}

export function SeccionMerma({
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
          title="Diferencia declarado vs propio"
          description="Diferencia entre kilos declarados en planilla y kilos propios medidos"
          csvHref={csvHref}
        />
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          Sin datos todavía. Cuando los operarios carguen el peso propio de los
          rollos, la diferencia aparecerá acá.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Diferencia declarado vs propio"
        description="Diferencia entre kilos declarados en planilla y kilos propios medidos"
        csvHref={csvHref}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Diferencia total
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {data.total_merma_kg.toFixed(2)}{' '}
            <span className="text-base font-normal text-muted-foreground">kg</span>
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Diferencia promedio
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
            sobre {data.total_kilos_planilla.toFixed(2)} kg declarados
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
            <thead className="bg-muted/40 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Color</th>
                <th className="px-4 py-3 font-medium text-right">Kg declarado</th>
                <th className="px-4 py-3 font-medium text-right">Kg propios</th>
                <th className="px-4 py-3 font-medium text-right">Diferencia kg</th>
                <th className="px-4 py-3 font-medium text-right">Diferencia %</th>
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
            <tfoot className="bg-muted/40 border-t">
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

export function SeccionDiferencias({
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
        title="Diferencias por rollo (proveedor vs propio)"
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
              className={totalDifKilos < 0 ? 'text-destructive' : 'text-success'}
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
                <thead className="bg-muted/40 border-b">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Pieza</th>
                    <th className="px-4 py-3 font-medium">Artículo</th>
                    <th className="px-4 py-3 font-medium">Color</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Kg declarado
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
                          r.dif_kilos < 0 ? 'text-destructive' : 'text-success'
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
              <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/40">
                Mostrando 100 de {data.length}. Exportá a CSV para verlos todos.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
