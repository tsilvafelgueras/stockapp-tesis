'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export default function OrigenIaChart({
  ia,
  manual,
}: {
  ia: number
  manual: number
}) {
  const data = [
    { name: 'Planilla IA', value: ia, color: 'var(--chart-2)' },
    { name: 'Manual', value: manual, color: 'var(--chart-1)' },
  ].filter((d) => d.value > 0)
  const total = ia + manual

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const v = Number(value)
            const pct = total > 0 ? (v / total) * 100 : 0
            const name = (item?.payload as { name?: string } | undefined)?.name ?? ''
            return [`${v} ingresos · ${pct.toFixed(0)}%`, name]
          }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
