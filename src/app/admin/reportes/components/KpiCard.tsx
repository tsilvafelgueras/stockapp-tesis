import type { LucideIcon } from 'lucide-react'

type Tone = 'default' | 'warning' | 'destructive' | 'success'

const toneValueClass: Record<Tone, string> = {
  default: '',
  warning: 'text-warning',
  destructive: 'text-destructive',
  success: 'text-success',
}

const toneIconClass: Record<Tone, string> = {
  default: 'bg-accent text-action',
  warning: 'bg-warning/12 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
  success: 'bg-success/12 text-success',
}

/**
 * Card de KPI reutilizable en todos los bloques de reportes.
 * `value` ya viene formateado (string) o como número; el detalle es opcional.
 */
export default function KpiCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  detail?: string
  icon?: LucideIcon
  tone?: Tone
}) {
  const display =
    typeof value === 'number' ? value.toLocaleString('es-AR') : value

  return (
    <div className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-md ${toneIconClass[tone]}`}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p
        className={`mt-2 font-heading text-2xl font-bold tabular-nums ${toneValueClass[tone]}`}
      >
        {display}
        {unit && (
          <span className="ml-1 text-base font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}
