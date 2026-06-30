/**
 * Normaliza una fecha a formato ISO `YYYY-MM-DD` (el que requiere
 * `<input type="date">`).
 *
 * Acepta:
 *   - "2026-05-03"        → "2026-05-03"
 *   - "03/05/2026"        → "2026-05-03"  (DD/MM/YYYY, formato argentino)
 *   - "3/5/26"            → "2026-05-03"  (año 2 dígitos = 20YY)
 *   - "03-05-2026"        → "2026-05-03"
 *   - "2026-05-03T00:..." → "2026-05-03"  (timestamp ISO con hora)
 *
 * Si el formato no se reconoce, devuelve null para no romper el input.
 */
export function normalizarFechaISO(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // Ya está en YYYY-MM-DD (con o sin hora detrás)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // Formato argentino: DD/MM/YYYY, DD-MM-YYYY, D/M/YY, etc.
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (dmy) {
    const [, dd, mm, yy] = dmy
    const year = yy.length === 2 ? `20${yy}` : yy
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  return null
}

/**
 * Indica si una fecha cae dentro del rango `[desde, hasta]` (ambos inclusive).
 *
 * - `desde` y `hasta` son strings ISO `YYYY-MM-DD` provenientes de un
 *   `<input type="date">`. Cualquiera puede venir vacío (`''`):
 *     - sin `desde` ni `hasta`  → no hay filtro, todo pasa (devuelve `true`).
 *     - solo `desde`            → desde esa fecha en adelante.
 *     - solo `hasta`            → hasta esa fecha inclusive.
 *     - ambos iguales           → un único día (búsqueda por fecha puntual).
 * - `fecha` es la fecha del registro; se normaliza con `normalizarFechaISO`,
 *   así que tolera formatos argentinos además del ISO. Si no hay fecha o no
 *   se reconoce su formato, queda fuera de cualquier rango activo.
 *
 * La comparación es lexicográfica sobre `YYYY-MM-DD`, que para fechas ISO
 * coincide con el orden cronológico.
 */
export function fechaEnRango(
  fecha: string | null | undefined,
  desde: string,
  hasta: string
): boolean {
  if (!desde && !hasta) return true

  const f = normalizarFechaISO(fecha)
  if (!f) return false

  if (desde && f < desde) return false
  if (hasta && f > hasta) return false
  return true
}
