import { Layers, Trash2, FlaskConical, Link2 } from 'lucide-react'
import KpiCard from './KpiCard'
import ChartCard from './ChartCard'
import FallasDonaChart from '../charts/FallasDonaChart'
import DegradadosChart from '../charts/DegradadosChart'
import HorizontalBarChart, { type BarDatum } from '../charts/HorizontalBarChart'
import { SeccionMerma } from './LegacySections'
import type {
  FallaCategoriaRow,
  DegradadosResult,
  MuestrasResult,
  GramajeRow,
  MermaPartidaResult,
  MermaPartidaRow,
} from '../queries/calidad'
import type { MermaResult } from '../queries'

const fmtKg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fmt1 = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export type TabCalidadData = {
  fallas: FallaCategoriaRow[]
  degradados: DegradadosResult
  muestras: MuestrasResult
  gramaje: GramajeRow[]
  merma: MermaResult
  mermaPartida: MermaPartidaResult
}

export default function TabCalidad({
  data,
  csv,
}: {
  data: TabCalidadData
  csv: Record<'merma' | 'muestras' | 'gramaje' | 'mermaPartida', string>
}) {
  const { fallas, degradados, muestras, gramaje, merma, mermaPartida } = data
  const kgDegradados = degradados.totalKgBaja + degradados.totalKgSegunda

  const mermaPorTint: BarDatum[] = mermaPartida.porTintoreria.map((t) => ({
    label: t.tintoreria,
    value: Math.round(t.mermaKg),
    color: t.mermaKg > 0 ? 'var(--chart-5)' : 'var(--chart-3)',
  }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Rollos en segunda"
          value={degradados.rollosSegunda}
          icon={Layers}
          tone={degradados.rollosSegunda > 0 ? 'destructive' : 'default'}
          detail="Degradados a calidad inferior"
        />
        <KpiCard
          label="Kg degradados"
          value={fmtKg(kgDegradados)}
          unit="kg"
          icon={Trash2}
          tone={kgDegradados > 0 ? 'warning' : 'default'}
          detail="Baja + segunda en el período"
        />
        <KpiCard
          label="Kg en muestras"
          value={fmtKg(muestras.kilosTotales)}
          unit="kg"
          icon={FlaskConical}
          detail={`${muestras.totalMuestras} muestras`}
        />
        <KpiCard
          label="Muestras vinculadas"
          value={`${fmt1(muestras.vinculadasPct)}%`}
          icon={Link2}
          detail={`${muestras.vinculadas} ligadas a un pedido`}
        />
      </div>

      {/* Merma de teñido por partida (crudo → teñido) */}
      <ChartCard
        title="Merma de teñido por partida"
        description="Kilos de crudo que salieron a teñir vs kilos teñidos recibidos. Positivo = se perdió peso en el proceso. Sin valorizar."
        csvHref={csv.mermaPartida}
        isEmpty={mermaPartida.partidas.length === 0}
        emptyMessage="Todavía no se cargaron kilos de crudo en ninguna partida. Cargalos en el detalle del ingreso."
      >
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Resumen label="Crudo enviado" value={`${fmtKg(mermaPartida.totalCrudo)} kg`} />
          <Resumen label="Teñido recibido" value={`${fmtKg(mermaPartida.totalTenido)} kg`} />
          <Resumen
            label="Merma total"
            value={`${fmtKg(mermaPartida.totalMermaKg)} kg`}
            tone={mermaPartida.totalMermaKg > 0 ? 'warning' : 'success'}
          />
          <Resumen
            label="Merma %"
            value={`${fmt1(mermaPartida.totalMermaPct)}%`}
            tone={
              mermaPartida.totalMermaPct > 10
                ? 'destructive'
                : mermaPartida.totalMermaPct > 0
                  ? 'warning'
                  : 'success'
            }
          />
        </div>
        {mermaPorTint.length > 1 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Merma por tintorería (kg)
            </p>
            <HorizontalBarChart data={mermaPorTint} unit="kg" />
          </div>
        )}
        <MermaPartidaTable rows={mermaPartida.partidas} />
      </ChartCard>

      {/* Fallas + degradados */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Distribución de fallas por categoría"
          description="Rollos en segunda según el tipo de falla."
          isEmpty={fallas.length === 0}
          emptyMessage="Sin rollos en segunda en el período."
        >
          <FallasDonaChart data={fallas} />
        </ChartCard>

        <ChartCard
          title="Kilos degradados por mes"
          description="Kilos perdidos o degradados (baja + segunda). Sin valorizar: todavía no hay costo cargado."
          isEmpty={degradados.meses.length === 0}
          emptyMessage="Sin kilos degradados en el período."
        >
          <DegradadosChart data={degradados.meses} />
          <div className="mt-3 flex justify-center gap-6 text-xs text-muted-foreground">
            <span>
              Segunda:{' '}
              <strong className="text-foreground">
                {fmtKg(degradados.totalKgSegunda)} kg
              </strong>
            </span>
            <span>
              Baja:{' '}
              <strong className="text-foreground">
                {fmtKg(degradados.totalKgBaja)} kg
              </strong>
            </span>
          </div>
        </ChartCard>
      </div>

      {/* Diferencia declarado vs propio (kilos) — sección heredada */}
      <SeccionMerma data={merma} csvHref={csv.merma} />

      {/* Diferencia de gramaje */}
      <ChartCard
        title="Diferencia de gramaje (declarado vs medido)"
        description="Solo rollos con gramaje propio cargado. Detecta inconsistencias entre lo que dice la planilla y lo medido."
        csvHref={csv.gramaje}
        isEmpty={gramaje.length === 0}
        emptyMessage="Todavía no hay rollos con gramaje propio medido."
      >
        <GramajeTable rows={gramaje} />
      </ChartCard>

      {/* Muestras */}
      <ChartCard
        title="Muestras por cliente"
        description="Kilos regalados como muestra, por cliente. Top 10."
        csvHref={csv.muestras}
        isEmpty={muestras.topClientes.length === 0}
        emptyMessage="Sin muestras registradas en el período."
      >
        <MuestrasTable rows={muestras.topClientes} />
      </ChartCard>
    </div>
  )
}

// ── Resumen (métrica chica) ─────────────────────────────────

function Resumen({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warning' | 'destructive' | 'success'
}) {
  const toneCls =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'success'
          ? 'text-success'
          : ''
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-heading text-lg font-bold tabular-nums ${toneCls}`}>
        {value}
      </p>
    </div>
  )
}

// ── Tabla de merma por partida ──────────────────────────────

function MermaPartidaTable({ rows }: { rows: MermaPartidaRow[] }) {
  return (
    <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Partida</th>
            <th className="pb-2 pr-4 font-medium">Tintorería</th>
            <th className="pb-2 pr-4 font-medium text-right">Crudo</th>
            <th className="pb-2 pr-4 font-medium text-right">Teñido</th>
            <th className="pb-2 pr-4 font-medium text-right">Merma kg</th>
            <th className="pb-2 font-medium text-right">Merma %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ingreso_id} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.partida}</td>
              <td className="py-2 pr-4">{r.tintoreria}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(r.crudo)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{fmtKg(r.tenido)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.mermaKg)}
              </td>
              <td
                className={`py-2 text-right tabular-nums font-medium ${
                  r.mermaPct > 10
                    ? 'text-destructive'
                    : r.mermaPct > 0
                      ? 'text-warning'
                      : 'text-success'
                }`}
              >
                {fmt1(r.mermaPct)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabla de diferencia de gramaje ──────────────────────────

function GramajeTable({ rows }: { rows: GramajeRow[] }) {
  return (
    <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Tintorería</th>
            <th className="pb-2 pr-4 font-medium">Artículo</th>
            <th className="pb-2 pr-4 font-medium">Color</th>
            <th className="pb-2 pr-4 font-medium text-right">Rollos</th>
            <th className="pb-2 pr-4 font-medium text-right">Planilla</th>
            <th className="pb-2 pr-4 font-medium text-right">Propio</th>
            <th className="pb-2 font-medium text-right">Dif. prom.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.tintoreria}-${r.articulo}-${r.color}-${i}`} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.tintoreria}</td>
              <td className="py-2 pr-4">{r.articulo}</td>
              <td className="py-2 pr-4">{r.color}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.rollos}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmt1(r.gramajePlanilla)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmt1(r.gramajePropio)}
              </td>
              <td
                className={`py-2 text-right tabular-nums font-medium ${
                  Math.abs(r.difPromedio) > 5
                    ? 'text-destructive'
                    : Math.abs(r.difPromedio) > 2
                      ? 'text-warning'
                      : 'text-muted-foreground'
                }`}
              >
                {r.difPromedio > 0 ? '+' : ''}
                {fmt1(r.difPromedio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabla de muestras por cliente ───────────────────────────

function MuestrasTable({
  rows,
}: {
  rows: MuestrasResult['topClientes']
}) {
  const max = Math.max(1, ...rows.map((r) => r.kilos))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Cliente</th>
            <th className="pb-2 pr-4 font-medium text-right">Muestras</th>
            <th className="pb-2 pr-4 font-medium text-right">Kilos</th>
            <th className="hidden pb-2 font-medium sm:table-cell">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cliente} className="border-t">
              <td className="py-2 pr-4 font-medium">{r.cliente}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.muestras}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtKg(r.kilos)}
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
