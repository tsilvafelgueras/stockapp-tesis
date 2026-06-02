import { FileCheck, MapPin, Sparkles } from 'lucide-react'
import KpiCard from './KpiCard'
import ChartCard from './ChartCard'
import OrigenIaChart from '../charts/OrigenIaChart'
import OrigenMensualChart from '../charts/OrigenMensualChart'
import TendenciaMensualChart from '../charts/TendenciaMensualChart'
import type {
  OrigenResult,
  TendenciaMes,
  HealthCheck,
  ActividadUsuarioRow,
} from '../queries/eficiencia'

const fmt1 = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

function tone(pct: number): 'success' | 'warning' | 'destructive' {
  if (pct >= 70) return 'success'
  if (pct >= 40) return 'warning'
  return 'destructive'
}

export type TabEficienciaData = {
  origen: OrigenResult
  tendencia: TendenciaMes[]
  health: HealthCheck
  actividad: ActividadUsuarioRow[]
}

export default function TabEficiencia({
  data,
  csv,
}: {
  data: TabEficienciaData
  csv: Record<'tendencia' | 'actividad', string>
}) {
  const { origen, tendencia, health, actividad } = data

  return (
    <div className="space-y-6">
      {/* Health check */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Ingresos con planilla"
          value={`${fmt1(health.ingresosConPlanillaPct)}%`}
          icon={FileCheck}
          tone={tone(health.ingresosConPlanillaPct)}
          detail={`${health.ingresosTotal} ingresos en el período`}
        />
        <KpiCard
          label="Rollos con ubicación"
          value={`${fmt1(health.rollosConUbicacionPct)}%`}
          icon={MapPin}
          tone={tone(health.rollosConUbicacionPct)}
          detail={`${health.rollosTotal} rollos en el período`}
        />
        <KpiCard
          label="Ingresos por IA"
          value={`${fmt1(origen.iaPct)}%`}
          icon={Sparkles}
          detail={`${origen.ia} de ${origen.total} con planilla IA`}
        />
      </div>

      {/* Origen IA vs manual */}
      <ChartCard
        title="Ingresos: IA vs manual"
        description="Proporción de ingresos cargados con planilla por IA vs carga manual, y su evolución mensual."
        isEmpty={origen.total === 0}
        emptyMessage="Sin ingresos en el período."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <OrigenIaChart ia={origen.ia} manual={origen.manual} />
          {origen.meses.length > 0 && (
            <OrigenMensualChart data={origen.meses} />
          )}
        </div>
      </ChartCard>

      {/* Tendencia mensual */}
      <ChartCard
        title="Tendencia mensual (kilos)"
        description="Kilos ingresados, egresados y neto acumulado del período, mes a mes. Usa proxies de fecha (alta del rollo y egreso del pedido)."
        csvHref={csv.tendencia}
        isEmpty={tendencia.length === 0}
        emptyMessage="Sin movimientos en el período."
      >
        <TendenciaMensualChart data={tendencia} />
      </ChartCard>

      {/* Actividad por usuario (toggle) */}
      <details className="group rounded-lg border bg-white shadow-sm">
        <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-heading text-base font-semibold marker:content-none">
          <span>Actividad por usuario</span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            Mostrar ▾
          </span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
            Ocultar ▴
          </span>
        </summary>
        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Rollos cargados, confirmados (cambios de estado) y pickeados por
              usuario, según el historial de movimientos.
            </p>
            <a
              href={csv.actividad}
              download
              className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              Exportar CSV
            </a>
          </div>
          {actividad.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin actividad registrada en el período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Usuario</th>
                    <th className="pb-2 pr-4 font-medium text-right">Cargados</th>
                    <th className="pb-2 pr-4 font-medium text-right">Confirmados</th>
                    <th className="pb-2 font-medium text-right">Pickeados</th>
                  </tr>
                </thead>
                <tbody>
                  {actividad.map((r) => (
                    <tr key={r.usuario} className="border-t">
                      <td className="py-2 pr-4 font-medium">{r.usuario}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {r.cargados}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {r.confirmados}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {r.pickeados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
