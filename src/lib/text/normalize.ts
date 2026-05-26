/**
 * Normaliza un string a Title Case canónico (trim + minúsculas + primera
 * letra de cada palabra en mayúscula, Unicode-aware).
 *
 * "AZUL MARINO"  → "Azul Marino"
 * "  lycra ml40" → "Lycra Ml40"
 * null / ""      → ""
 *
 * Mantenelo consistente con el helper SQL `public.title_case` (migración
 * 038) para que app y DB normalicen igual.
 */
export function normalizarTitleCase(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}
