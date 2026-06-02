'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TiempoEtapaRow } from '../queries/demanda'

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export default function TiempoEtapaChart({
  data,
}: {
  data: TiempoEtapaRow[]
}) {
  // Solo etapas con al menos un pedido medido.
  const rows = data
    .filter((r) => r.diasPromedio != null)
    .map((r) => ({ ...r, dias: r.diasPromedio as number }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => fmt(Number(v))}
          unit="d"
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          formatter={(value, _name, item) => {
            const n = (item?.payload as { pedidosMedidos?: number })?.pedidosMedidos ?? 0
            return [`${fmt(Number(value))} días · ${n} pedidos`, '']
          }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="dias" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
