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
import type { OrigenMes } from '../queries/eficiencia'

/** Adopción de la carga por IA mes a mes (IA vs manual, apilado). */
export default function OrigenMensualChart({ data }: { data: OrigenMes[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          formatter={(value, name) => [
            `${Number(value)} ingresos`,
            name === 'ia' ? 'Planilla IA' : 'Manual',
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
              {value === 'ia' ? 'Planilla IA' : 'Manual'}
            </span>
          )}
        />
        <Bar dataKey="ia" stackId="o" fill="var(--chart-2)" />
        <Bar dataKey="manual" stackId="o" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
