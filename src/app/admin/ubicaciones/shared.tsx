export const TIPOS = [
  { value: 'general', label: 'General' },
  { value: 'rack', label: 'Rack' },
  { value: 'piso', label: 'Piso' },
  { value: 'preparacion', label: 'Preparación' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'otro', label: 'Otro' },
]

export function tipoLabel(tipo: string) {
  return TIPOS.find((t) => t.value === tipo)?.label ?? tipo
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export function OcupacionValue({
  current,
  capacity,
  unit,
  decimals = 0,
}: {
  current: number
  capacity: number | null
  unit: string
  decimals?: number
}) {
  const value = decimals > 0 ? current.toFixed(decimals) : current.toString()
  const cap =
    capacity == null
      ? null
      : decimals > 0
        ? Number(capacity).toFixed(decimals)
        : capacity.toString()
  const pct =
    capacity && capacity > 0
      ? Math.min(100, Math.round((Number(current) / Number(capacity)) * 100))
      : null

  return (
    <div className="space-y-1">
      <div>
        {value}
        {cap ? ` / ${cap}` : ''} <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      {pct != null && (
        <div className="ml-auto h-1.5 w-24 rounded-full bg-zinc-100">
          <div
            className={`h-1.5 rounded-full ${
              pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
