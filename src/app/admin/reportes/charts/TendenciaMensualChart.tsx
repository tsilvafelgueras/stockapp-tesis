'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TendenciaMes } from '../queries/eficiencia'

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

const NOMBRES: Record<string, string> = {
  ingresadosKg: 'Ingresados',
  egresadosKg: 'Egresados',
  netoAcumKg: 'Neto acumulado',
}

export default function TendenciaMensualChart({
  data,
}: {
  data: TendenciaMes[]
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
          formatter={(value, name) => [
            `${fmt(Number(value))} kg`,
            NOMBRES[name as string] ?? name,
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
              {NOMBRES[value as string] ?? value}
            </span>
          )}
        />
        <Line
          type="monotone"
          dataKey="ingresadosKg"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
        <Line
          type="monotone"
          dataKey="egresadosKg"
          stroke="var(--chart-5)"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
        <Line
          type="monotone"
          dataKey="netoAcumKg"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
