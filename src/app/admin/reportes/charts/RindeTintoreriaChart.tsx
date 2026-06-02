'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ScorecardRow } from '../queries/tintorerias'

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Rinde promedio ponderado por kilos, por tintorería. Resalta la mejor
 * (verde) y la peor (rojo); el resto en navy.
 */
export default function RindeTintoreriaChart({
  data,
}: {
  data: ScorecardRow[]
}) {
  const rows = data
    .filter((r) => r.rindePonderado != null)
    .map((r) => ({ tintoreria: r.tintoreria, rinde: r.rindePonderado as number }))

  const valores = rows.map((r) => r.rinde)
  const max = Math.max(...valores)
  const min = Math.min(...valores)

  function color(rinde: number): string {
    if (rows.length > 1 && rinde === max) return 'var(--chart-3)'
    if (rows.length > 1 && rinde === min) return 'var(--chart-5)'
    return 'var(--chart-1)'
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="tintoreria"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => fmt(Number(v))}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          formatter={(value) => [`${fmt(Number(value))} m/kg`, 'Rinde']}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="rinde" radius={[4, 4, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.tintoreria} fill={color(r.rinde)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
