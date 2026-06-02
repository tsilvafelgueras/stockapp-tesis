import { ClipboardList, PackageX, Scale, Ban } from 'lucide-react'
import KpiCard from './KpiCard'
import ChartCard from './ChartCard'
import HorizontalBarChart, { type BarDatum } from '../charts/HorizontalBarChart'
import TiempoEtapaChart from '../charts/TiempoEtapaChart'
import CanceladosAccordion from './CanceladosAccordion'
import type {
  DemandaActivaRow,
  FunnelRow,
  TiempoEtapaRow,
  ClienteRankingRow,
  CanceladosResult,
} from '../queries/demanda'

const fmtKg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fmtInt = (n: number) => n.toLocaleString('es-AR')

export type TabDemandaData = {
  demanda: DemandaActivaRow[]
  funnel: FunnelRow[]
  tiempo: TiempoEtapaRow[]
  ranking: ClienteRankingRow[]
  cancelados: CanceladosResult
}

export default function TabDemanda({
  data,
  csv,
}: {
  data: TabDemandaData
  csv: Record<'demanda' | 'ranking' | 'cancelados', string>
}) {
  const { demanda, funnel, tiempo, ranking, cancelados } = data

  const demandaKilos = demanda.reduce((s, r) => s + r.kilos, 0)

  // Agregado por artículo+color para la barra horizontal (top 12).
  const porComboMap = new Map<string, number>()
  for (const d of demanda) {
    const key = `${d.articulo} · ${d.color}`
    porComboMap.set(key, (porComboMap.get(key) ?? 0) + d.kilos)
  }
  const demandaCombo: BarDatum[] = [...porComboMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  const funnelData: BarDatum[] = funnel.map((f) => ({
    label: f.label,
    value: f.pedidos,
    color: 'var(--chart-1)',
  }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Demanda activa"
          value={fmtKg(demandaKilos)}
          unit="kg"
          icon={Scale}
          detail="Kilos pedidos sin stock para dar"
        />
        <KpiCard
          label="Demandas activas"
          value={demanda.length}
          icon={ClipboardList}
          detail="Pedidos de cliente sin satisfacer"
        />
        <KpiCard
          label="Pedidos caídos"
          value={cancelados.totalPedidos}
          icon={Ban}
          tone={cancelados.totalPedidos > 0 ? 'destructive' : 'default'}
          detail="Cancelados en el período"
        />
        <KpiCard
          label="Kg liberados"
          value={fmtKg(cancelados.kilosLiberados)}
          unit="kg"
          icon={PackageX}
          detail="Volvieron a stock por cancelación"
        />
      </div>

      {/* Demanda no satisfecha por artículo+color */}
      <ChartCard
        title="Demanda no satisfecha por artículo y color"
        description="Lo que los clientes pidieron y no pudimos darles. Sumado por kilos estimados. Es el reporte estrella para decidir qué producir."
        csvHref={csv.demanda}
        isEmpty={demandaCombo.length === 0}
        emptyMessage="No hay demanda pendiente registrada."
      >
        <HorizontalBarChart data={demandaCombo} unit="kg" color="var(--chart-5)" />
      </ChartCard>

      {/* Funnel + Tiempo por etapa */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Funnel de pedidos"
          description="Pedidos del período en cada estado del flujo."
          isEmpty={funnel.every((f) => f.pedidos === 0)}
          emptyMessage="Sin pedidos en el período."
        >
          <HorizontalBarChart data={funnelData} unit="pedidos" />
        </ChartCard>

        <ChartCard
          title="Tiempo promedio por etapa"
          description="Días que tarda un pedido en pasar de una etapa a la siguiente. Calculado sobre el historial de movimientos (desde mig. 021)."
          isEmpty={tiempo.every((t) => t.diasPromedio == null)}
          emptyMessage="Todavía no hay suficientes cambios de estado registrados."
        >
          <TiempoEtapaChart data={tiempo} />
        </ChartCard>
      </div>

      {/* Ranking de clientes */}
      <ChartCard
        title="Ranking de clientes"
        description="Top 10 por kilos comprados en el período (pedidos entregados). Ticket = kilos por pedido."
        csvHref={csv.ranking}
        isEmpty={ranking.length === 0}
        emptyMessage="Sin ventas entregadas en el período."
      >
        <RankingTable rows={ranking} />
      </ChartCard>

      {/* Demanda por antigüedad */}
      <ChartCard
        title="Demanda pendiente por antigüedad"
        description="Cuánto hace que está esperando cada pedido sin stock. Verde < 3 días, naranja 3–7, rojo > 7."
        csvHref={csv.demanda}
        isEmpty={demanda.length === 0}
        emptyMessage="No hay demanda pendiente."
      >
        <AntiguedadTable rows={demanda} />
      </ChartCard>

      {/* Pedidos caídos */}
      <ChartCard
        title="Pedidos caídos"
        description="Pedidos cancelados en el período, por motivo, con los kilos que se liberaron."
        csvHref={csv.cancelados}
        isEmpty={cancelados.totalPedidos === 0}
        emptyMessage="Sin pedidos caídos en el período."
      >
        <CanceladosAccordion data={cancelados} />
      </ChartCard>
    </div>
  )
}

// ── Ranking con barras inline ───────────────────────────────

function RankingTable({ rows }: { rows: ClienteRankingRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.kilos))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Cliente</th>
            <th className="pb-2 pr-4 font-medium text-right">Pedidos</th>
            <th className="pb-2 pr-4 font-medium text-right">Kilos</th>
            <th className="pb-2 pr-4 font-medium text-right">Ticket prom.</th>
            <th className="hidden pb-2 font-medium sm:table-cell">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cliente} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.cliente}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.pedidos}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.kilos)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {fmtKg(r.ticketPromedio)}
              </td>
              <td className="hidden w-1/3 py-2 sm:table-cell">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1"
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

// ── Tabla de antigüedad con badge de días y prioridad ───────

function diaBucket(dias: number): string {
  if (dias < 3) return 'bg-success/12 text-success'
  if (dias <= 7) return 'bg-warning/12 text-warning'
  return 'bg-destructive/12 text-destructive'
}

const PRIORIDAD: Record<string, { label: string; className: string }> = {
  critica: { label: 'Crítica', className: 'bg-destructive/12 text-destructive' },
  alta: { label: 'Alta', className: 'bg-warning/12 text-warning' },
  programada: { label: 'Programada', className: 'bg-accent text-action' },
  flexible: { label: 'Flexible', className: 'bg-muted text-muted-foreground' },
}

function AntiguedadTable({ rows }: { rows: DemandaActivaRow[] }) {
  return (
    <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Cliente</th>
            <th className="pb-2 pr-4 font-medium">Artículo</th>
            <th className="pb-2 pr-4 font-medium">Color</th>
            <th className="pb-2 pr-4 font-medium text-right">Kg est.</th>
            <th className="pb-2 pr-4 font-medium">Prioridad</th>
            <th className="pb-2 font-medium text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.cliente}</td>
              <td className="py-2 pr-4">{r.articulo}</td>
              <td className="py-2 pr-4">{r.color}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.kilos)}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    (PRIORIDAD[r.prioridad] ?? PRIORIDAD.flexible).className
                  }`}
                >
                  {(PRIORIDAD[r.prioridad] ?? PRIORIDAD.flexible).label}
                </span>
              </td>
              <td className="py-2 text-right">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${diaBucket(
                    r.dias
                  )}`}
                >
                  {fmtInt(r.dias)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

