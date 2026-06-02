'use client'

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RotacionABCRow } from '../queries/stock'

// Color de la barra según clase ABC: A = navy (lo más vendido), B = azul,
// C = naranja (cola larga / baja rotación).
const COLOR_POR_CLASE: Record<RotacionABCRow['clase'], string> = {
  A: 'var(--chart-1)',
  B: 'var(--chart-2)',
  C: 'var(--chart-4)',
}

const fmtKg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

export default function RotacionABCChart({ data }: { data: RotacionABCRow[] }) {
  // Limitamos a 20 artículos para que el eje X sea legible; el resto igual
  // queda contemplado en el % acumulado.
  const rows = data.slice(0, 20)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="articulo"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          angle={-30}
          textAnchor="end"
          height={70}
          interval={0}
        />
        <YAxis
          yAxisId="kg"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={fmtKg}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, 100]}
          unit="%"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value)
            return name === 'pctAcumulado'
              ? [`${v.toFixed(1)}%`, '% acumulado']
              : [`${fmtKg(v)} kg`, 'Kg vendidos']
          }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <ReferenceLine
          yAxisId="pct"
          y={80}
          stroke="var(--chart-5)"
          strokeDasharray="4 4"
          label={{ value: 'A (80%)', fontSize: 10, fill: 'var(--chart-5)', position: 'right' }}
        />
        <Bar yAxisId="kg" dataKey="kilosVendidos" radius={[3, 3, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.articulo_id} fill={COLOR_POR_CLASE[r.clase]} />
          ))}
        </Bar>
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="pctAcumulado"
          stroke="var(--chart-4)"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
