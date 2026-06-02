'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DegradadosMes } from '../queries/calidad'

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

/**
 * Kilos degradados por mes: segunda (naranja) y baja (rojo), apilados.
 */
export default function DegradadosChart({ data }: { data: DegradadosMes[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => fmt(Number(v))}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          formatter={(value, name) => [
            `${fmt(Number(value))} kg`,
            name === 'kgSegunda' ? 'Segunda' : 'Baja',
          ]}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">
              {value === 'kgSegunda' ? 'Segunda' : 'Baja'}
            </span>
          )}
        />
        <Bar dataKey="kgSegunda" stackId="d" fill="var(--chart-4)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="kgBaja" stackId="d" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
