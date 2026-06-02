import { createClient } from '@/lib/supabase/server'

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ReportesFilters = {
  /** ID de tintorería para filtrar rollos por origen (stock, merma, diferencias, antigüedad). */
  tintoreriaId?: string
  tintoreriaIds?: string[]
  /** ID de artículo. */
  articuloId?: string
  articuloIds?: string[]
  /** Año en formato 4 dígitos. */
  anio?: number
  /** Mes 1-12. Si se omite y hay año → todo el año. */
  mes?: number
  meses?: number[]
  /** Rango de fechas explícito (ISO yyyy-mm-dd). Si está, tiene prioridad sobre anio/mes. */
  desde?: string
  hasta?: string
}

export function listOrSingle(list?: string[], single?: string): string[] {
  return list?.length ? list : single ? [single] : []
}

export function monthList(filters: ReportesFilters): number[] {
  if (filters.meses?.length) return filters.meses
  return filters.mes ? [filters.mes] : []
}

export function rowMatchesMonths(createdAt: string, meses: number[]): boolean {
  if (meses.length === 0) return true
  return meses.includes(new Date(createdAt).getMonth() + 1)
}

export async function colorNameById(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const { data } = await supabase.from('colores').select('id, nombre')
  return new Map((data ?? []).map((c) => [c.id, c.nombre]))
}

/**
 * Devuelve el rango [desde, hasta) en ISO y un label legible.
 *
 * Prioridad: si vienen `desde`/`hasta` explícitos (rango de fechas), se usan
 * esos. Si no, se arma a partir de año + meses. Si tampoco hay año, default al
 * mes actual.
 */
export function rangoPeriodo(filters: ReportesFilters): {
  desde: string
  hasta: string
  label: string
} {
  // Rango de fechas explícito tiene prioridad.
  if (filters.desde && filters.hasta) {
    const desde = new Date(filters.desde + 'T00:00:00')
    // `hasta` es inclusivo en la UI → sumamos un día para el límite [desde, hasta).
    const hastaExcl = new Date(filters.hasta + 'T00:00:00')
    hastaExcl.setDate(hastaExcl.getDate() + 1)
    return {
      desde: desde.toISOString(),
      hasta: hastaExcl.toISOString(),
      label: `${desde.toLocaleDateString('es-AR')} – ${new Date(
        filters.hasta + 'T00:00:00'
      ).toLocaleDateString('es-AR')}`,
    }
  }

  const meses = monthList(filters).sort((a, b) => a - b)
  if (filters.anio && meses.length > 0) {
    const desde = new Date(filters.anio, meses[0] - 1, 1)
    const hasta = new Date(filters.anio, meses[meses.length - 1], 1)
    const label =
      meses.length === 1
        ? desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        : `${meses.length} meses de ${filters.anio}`
    return { desde: desde.toISOString(), hasta: hasta.toISOString(), label }
  }
  if (filters.anio) {
    const desde = new Date(filters.anio, 0, 1)
    const hasta = new Date(filters.anio + 1, 0, 1)
    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      label: `año ${filters.anio}`,
    }
  }
  // Default: mes actual
  const inicio = new Date()
  inicio.setDate(1)
  inicio.setHours(0, 0, 0, 0)
  const finMes = new Date(inicio)
  finMes.setMonth(finMes.getMonth() + 1)
  return {
    desde: inicio.toISOString(),
    hasta: finMes.toISOString(),
    label: inicio.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    }),
  }
}
