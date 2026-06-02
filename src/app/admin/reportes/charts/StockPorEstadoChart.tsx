'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { StockPorEstadoRow } from '../queries/stock'

// Mapeo de color consistente con la paleta del tema (tokens --chart-*):
// en_stock = navy (neutro/stock), reservado = naranja (en proceso),
// segunda = rojo (alerta de calidad).
const COLOR_POR_ESTADO: Record<StockPorEstadoRow['estado'], string> = {
  en_stock: 'var(--chart-1)',
  reservado: 'var(--chart-4)',
  segunda: 'var(--chart-5)',
}

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

export default function StockPorEstadoChart({
  data,
}: {
  data: StockPorEstadoRow[]
}) {
  const conDatos = data.filter((d) => d.rollos > 0)
  const totalKilos = conDatos.reduce((s, d) => s + d.kilos, 0)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={conDatos}
          dataKey="kilos"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {conDatos.map((d) => (
            <Cell key={d.estado} fill={COLOR_POR_ESTADO[d.estado]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const v = Number(value)
            const pct = totalKilos > 0 ? (v / totalKilos) * 100 : 0
            const payload = item?.payload as StockPorEstadoRow | undefined
            const rollos = payload?.rollos ?? 0
            return [
              `${fmt(v)} kg · ${rollos} rollos · ${pct.toFixed(1)}%`,
              payload?.label ?? '',
            ]
          }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
