'use client'

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type BarDatum = {
  label: string
  value: number
  /** Color opcional por barra (var(--chart-*)). Si falta, usa `color`. */
  color?: string
}

/**
 * Barras horizontales genéricas. El orden de `data` se respeta tal cual
 * (el caller decide si ordenar desc o mantener orden de flujo).
 */
export default function HorizontalBarChart({
  data,
  unit = '',
  color = 'var(--chart-2)',
  maxLabel = 22,
}: {
  data: BarDatum[]
  unit?: string
  color?: string
  maxLabel?: number
}) {
  const height = Math.max(140, data.length * 38 + 16)
  const fmt = (n: number) =>
    n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 12, fill: 'var(--foreground)' }}
          tickFormatter={(v: string) =>
            v.length > maxLabel ? `${v.slice(0, maxLabel)}…` : v
          }
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          formatter={(value) => [`${fmt(Number(value))}${unit ? ' ' + unit : ''}`, '']}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{
          position: 'right',
          fontSize: 11,
          fill: 'var(--muted-foreground)',
          formatter: (v) => fmt(Number(v)),
        }}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
