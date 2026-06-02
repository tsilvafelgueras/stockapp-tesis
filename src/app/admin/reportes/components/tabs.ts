export type ReporteTab = {
  slug: string
  label: string
}

export const REPORTE_TABS: ReporteTab[] = [
  { slug: 'stock', label: 'Stock y rotación' },
  { slug: 'demanda', label: 'Demanda comercial' },
  { slug: 'tintorerias', label: 'Tintorerías' },
  { slug: 'calidad', label: 'Calidad y mermas' },
  { slug: 'eficiencia', label: 'Eficiencia operativa' },
]

export const DEFAULT_TAB = REPORTE_TABS[0].slug

/** Devuelve un slug de tab válido (o el default). */
export function normalizeTab(value?: string): string {
  return REPORTE_TABS.some((t) => t.slug === value) ? value! : DEFAULT_TAB
}
