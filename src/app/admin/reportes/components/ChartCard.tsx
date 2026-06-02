import { Download } from 'lucide-react'

/**
 * Contenedor estándar de una sección de reporte: título, descripción,
 * botón opcional de export CSV y manejo de estado vacío. Si `isEmpty` es
 * true muestra `emptyMessage` en vez de los children.
 */
export default function ChartCard({
  title,
  description,
  csvHref,
  isEmpty = false,
  emptyMessage = 'Sin datos en este período.',
  children,
}: {
  title: string
  description?: string
  csvHref?: string
  isEmpty?: boolean
  emptyMessage?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <header className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {csvHref && (
          <a
            href={csvHref}
            download
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </a>
        )}
      </header>
      <div className="p-4">
        {isEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
