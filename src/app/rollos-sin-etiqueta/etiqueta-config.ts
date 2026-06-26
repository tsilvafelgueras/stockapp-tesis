// Configuración de medidas de etiqueta (por empresa). Las medidas se guardan
// en mm en la tabla `empresa_etiqueta_config`. Si una empresa no tiene fila,
// se usan estos defaults (equivalen al stock 10×10 cm de la Zebra ZD220).
//
// `factor_escala` es la calibración por impresora: el driver suele reescalar
// la salida (p.ej. 10 cm declarados salen 4 cm). Renderizamos la etiqueta a
// medida × factor para compensar ese encogimiento. Ver EtiquetaLabel y
// la pantalla de ajustes.

export type EtiquetaConfig = {
  ancho_mm: number
  alto_mm: number
  padding_mm: number
  qr_mm: number
  factor_escala: number
}

export const DEFAULT_ETIQUETA_CONFIG: EtiquetaConfig = {
  ancho_mm: 100,
  alto_mm: 100,
  padding_mm: 2,
  qr_mm: 34,
  factor_escala: 1,
}

// Límites — deben coincidir con los CHECK de la migración 060.
export const ETIQUETA_LIMITES = {
  ancho_mm: { min: 10, max: 500 },
  alto_mm: { min: 10, max: 500 },
  padding_mm: { min: 0, max: 50 },
  qr_mm: { min: 5, max: 200 },
  factor_escala: { min: 0.1, max: 10 },
} as const

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Normaliza una fila cruda de la DB (o un objeto parcial) a una config válida,
// aplicando defaults y límites.
export function normalizeEtiquetaConfig(
  raw: Partial<Record<keyof EtiquetaConfig, unknown>> | null | undefined
): EtiquetaConfig {
  const d = DEFAULT_ETIQUETA_CONFIG
  if (!raw) return { ...d }
  return {
    ancho_mm: Math.round(clampNum(raw.ancho_mm, ETIQUETA_LIMITES.ancho_mm.min, ETIQUETA_LIMITES.ancho_mm.max, d.ancho_mm)),
    alto_mm: Math.round(clampNum(raw.alto_mm, ETIQUETA_LIMITES.alto_mm.min, ETIQUETA_LIMITES.alto_mm.max, d.alto_mm)),
    padding_mm: Math.round(clampNum(raw.padding_mm, ETIQUETA_LIMITES.padding_mm.min, ETIQUETA_LIMITES.padding_mm.max, d.padding_mm)),
    qr_mm: Math.round(clampNum(raw.qr_mm, ETIQUETA_LIMITES.qr_mm.min, ETIQUETA_LIMITES.qr_mm.max, d.qr_mm)),
    factor_escala: clampNum(raw.factor_escala, ETIQUETA_LIMITES.factor_escala.min, ETIQUETA_LIMITES.factor_escala.max, d.factor_escala),
  }
}

// Cliente Supabase mínimo que necesitamos (sirve para browser y server client).
// El builder de Supabase es un PromiseLike (thenable), no un Promise.
type MinimalSupabase = {
  from: (table: string) => {
    select: (cols: string) => {
      maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
    }
  }
}

// Lee la config de la empresa del usuario actual. RLS ya filtra por empresa,
// así que no hace falta pasar empresa_id. Devuelve defaults si no hay fila.
export async function loadEtiquetaConfig(
  supabase: MinimalSupabase
): Promise<EtiquetaConfig> {
  const { data } = await supabase
    .from('empresa_etiqueta_config')
    .select('ancho_mm, alto_mm, padding_mm, qr_mm, factor_escala')
    .maybeSingle()
  return normalizeEtiquetaConfig(
    data as Partial<Record<keyof EtiquetaConfig, unknown>> | null
  )
}
