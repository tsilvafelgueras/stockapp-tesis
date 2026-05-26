import { Info } from 'lucide-react'

const SECCIONES_OPERATIVAS: Record<string, string> = {
  ingresos: 'Ingresos',
  confirmar: 'Confirmar llegadas',
  picking: 'Picking',
  muestras: 'Muestras',
}

export default function SeccionDenegadaBanner({
  denegado,
}: {
  denegado?: string
}) {
  const seccion = denegado ? SECCIONES_OPERATIVAS[denegado] : null
  if (!seccion) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"
    >
      <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {seccion} es del equipo de operación
        </p>
        <p className="text-muted-foreground">
          Esa sección la maneja el rol Operario. Te traemos a tu panel.
        </p>
      </div>
    </div>
  )
}
