import { AlertTriangle, Boxes, Layers, Scale } from 'lucide-react'
import KpiCard from './KpiCard'
import ChartCard from './ChartCard'
import RotacionABCChart from '../charts/RotacionABCChart'
import StockPorEstadoChart from '../charts/StockPorEstadoChart'
import type {
  StockKpis,
  StockComboRow,
  CoberturaRow,
  CoberturaSemaforo,
  RotacionABCRow,
  RolloViejoRow,
  StockPorEstadoRow,
} from '../queries/stock'

const fmtKg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fmtInt = (n: number) => n.toLocaleString('es-AR')

export type TabStockData = {
  kpis: StockKpis
  stock: StockComboRow[]
  cobertura: CoberturaRow[]
  abc: RotacionABCRow[]
  viejos: RolloViejoRow[]
  porEstado: StockPorEstadoRow[]
}

export default function TabStock({
  data,
  csv,
}: {
  data: TabStockData
  csv: Record<'stock' | 'cobertura' | 'abc' | 'viejos', string>
}) {
  const { kpis, stock, cobertura, abc, viejos, porEstado } = data

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Kilos en stock"
          value={fmtKg(kpis.kilosEnStock)}
          unit="kg"
          icon={Scale}
          detail="Rollos en estado en stock"
        />
        <KpiCard
          label="Rollos en stock"
          value={kpis.rollosEnStock}
          icon={Boxes}
          detail="Piezas disponibles en depósito"
        />
        <KpiCard
          label="Bajo stock mínimo"
          value={kpis.combosBajoMinimo}
          icon={AlertTriangle}
          tone={kpis.combosBajoMinimo > 0 ? 'warning' : 'default'}
          detail="Combinaciones artículo+color"
        />
        <KpiCard
          label="Rollos en segunda"
          value={kpis.rollosSegunda}
          icon={Layers}
          tone={kpis.rollosSegunda > 0 ? 'destructive' : 'default'}
          detail="Calidad inferior"
        />
      </div>

      {/* Stock por artículo + color */}
      <ChartCard
        title="Stock por artículo y color"
        description="Kilos disponibles por combinación. En rojo, lo que está por debajo de su stock mínimo."
        csvHref={csv.stock}
        isEmpty={stock.length === 0}
        emptyMessage="Sin stock disponible con los filtros actuales."
      >
        <StockBarsTable rows={stock} />
      </ChartCard>

      {/* Distribución por estado + Días de cobertura, lado a lado en desktop */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Distribución de stock por estado"
          description="Kilos en stock, reservado y segunda."
          isEmpty={porEstado.every((e) => e.rollos === 0)}
          emptyMessage="Sin rollos para mostrar."
        >
          <StockPorEstadoChart data={porEstado} />
        </ChartCard>

        <ChartCard
          title="Días de cobertura por artículo"
          description="Stock actual ÷ venta diaria promedio (últimos 60 días). Proxy de fecha de egreso."
          csvHref={csv.cobertura}
          isEmpty={cobertura.length === 0}
          emptyMessage="Sin stock ni ventas para calcular cobertura."
        >
          <CoberturaTable rows={cobertura} />
        </ChartCard>
      </div>

      {/* Rotación ABC */}
      <ChartCard
        title="Rotación ABC (Pareto)"
        description="Artículos por kilos vendidos en el período. A = 80% del volumen, B = siguiente 15%, C = 5% restante."
        csvHref={csv.abc}
        isEmpty={abc.length === 0}
        emptyMessage="Sin ventas en el período para calcular rotación."
      >
        <RotacionABCChart data={abc} />
        <AbcResumen abc={abc} />
      </ChartCard>

      {/* Top 10 rollos más viejos */}
      <ChartCard
        title="Rollos más viejos en stock"
        description="Top 10 por días sin moverse. Días = desde la fecha de alta del rollo (proxy)."
        csvHref={csv.viejos}
        isEmpty={viejos.length === 0}
        emptyMessage="Sin rollos en stock."
      >
        <RollosViejosTable rows={viejos} />
      </ChartCard>
    </div>
  )
}

// ── Tabla de stock con barras de proporción ─────────────────

function StockBarsTable({ rows }: { rows: StockComboRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.kilos))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Artículo</th>
            <th className="pb-2 pr-4 font-medium">Color</th>
            <th className="pb-2 pr-4 font-medium text-right">Rollos</th>
            <th className="pb-2 pr-4 font-medium text-right">Kilos</th>
            <th className="hidden pb-2 font-medium sm:table-cell">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.articulo_id}-${r.color_id}`}
              className={`border-t ${r.bajoMinimo ? 'bg-destructive/5' : ''}`}
            >
              <td className="py-2 pr-4 font-medium">
                {r.articulo}
                {r.bajoMinimo && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    <AlertTriangle className="size-3" />
                    bajo mínimo
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{r.color}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.rollos}</td>
              <td
                className={`py-2 pr-4 text-right tabular-nums ${
                  r.bajoMinimo ? 'font-semibold text-destructive' : ''
                }`}
              >
                {fmtKg(r.kilos)}
                {r.stockMinimo != null && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    / mín {fmtKg(r.stockMinimo)}
                  </span>
                )}
              </td>
              <td className="hidden w-1/3 py-2 sm:table-cell">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      r.bajoMinimo ? 'bg-destructive' : 'bg-chart-1'
                    }`}
                    style={{ width: `${(r.kilos / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabla de cobertura con semáforo ─────────────────────────

const SEMAFORO: Record<
  CoberturaSemaforo,
  { label: string; className: string }
> = {
  critico: {
    label: 'Riesgo quiebre',
    className: 'bg-destructive/12 text-destructive',
  },
  ok: { label: 'Saludable', className: 'bg-success/12 text-success' },
  alto: { label: 'Alto', className: 'bg-warning/12 text-warning' },
  sobrestock: { label: 'Sobrestock', className: 'bg-warning/12 text-warning' },
  sin_dato: { label: 'Sin ventas', className: 'bg-muted text-muted-foreground' },
}

function CoberturaTable({ rows }: { rows: CoberturaRow[] }) {
  return (
    <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Artículo</th>
            <th className="pb-2 pr-4 font-medium text-right">Stock kg</th>
            <th className="pb-2 pr-4 font-medium text-right">Días</th>
            <th className="pb-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.articulo_id} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.articulo}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.kilosEnStock)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {r.diasCobertura == null ? '—' : Math.round(r.diasCobertura)}
              </td>
              <td className="py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    SEMAFORO[r.semaforo].className
                  }`}
                >
                  {SEMAFORO[r.semaforo].label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Resumen ABC bajo el gráfico ─────────────────────────────

function AbcResumen({ abc }: { abc: RotacionABCRow[] }) {
  const clases = (['A', 'B', 'C'] as const).map((clase) => {
    const items = abc.filter((r) => r.clase === clase)
    return {
      clase,
      articulos: items.length,
      kilos: items.reduce((s, r) => s + r.kilosVendidos, 0),
    }
  })
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {clases.map((c) => (
        <div key={c.clase} className="rounded-md border bg-muted/30 p-3 text-center">
          <p className="font-heading text-lg font-bold">Clase {c.clase}</p>
          <p className="text-xs text-muted-foreground">
            {c.articulos} artículo{c.articulos === 1 ? '' : 's'} · {fmtKg(c.kilos)} kg
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Tabla top 10 rollos más viejos ──────────────────────────

function RollosViejosTable({ rows }: { rows: RolloViejoRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Pieza</th>
            <th className="pb-2 pr-4 font-medium">Artículo</th>
            <th className="pb-2 pr-4 font-medium">Color</th>
            <th className="pb-2 pr-4 font-medium">Ubicación</th>
            <th className="pb-2 pr-4 font-medium text-right">Kilos</th>
            <th className="pb-2 font-medium text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.numero_pieza}</td>
              <td className="py-2 pr-4">{r.articulo}</td>
              <td className="py-2 pr-4">{r.color}</td>
              <td className="py-2 pr-4">{r.ubicacion}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.kilos)}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-warning">
                {fmtInt(r.dias)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
