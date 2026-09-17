/**
 * Interfaces públicas para extracción de planillas con IA.
 *
 * La IA nos devuelve cada campo extraído como `{ value, confidence }` para
 * que la UI pueda mostrar borde de "baja confianza" por campo.
 *
 * - `value` puede ser null si la IA no encontró el campo en la planilla.
 * - `confidence` va de 0 a 1. Umbral de "baja confianza" actualmente: 0.85.
 */

export type Field<T> = {
  value: T | null
  confidence: number
}

export type RolloExtraido = {
  numero_pieza: Field<string>
  kilos: Field<number>
  metros: Field<number>
  ratio: Field<number>
  gramaje_planilla: Field<number>
  articulo: Field<string>
  color: Field<string>
}

export type IngresoExtraido = {
  numero_remito: Field<string>
  fecha: Field<string> // ISO 'YYYY-MM-DD'
  // Color del lote a nivel header — fallback opcional para planillas con
  // un único color para todos los rollos. Si viene seteado y los rollos
  // no traen color propio, la UI lo aplica como bulk a todos los rollos.
  color: Field<string>
  ot: Field<string>
  rem_tejeduria: Field<string>
  referencia: Field<string>
  total_rollos_declarado: Field<number>
  total_kilos_declarado: Field<number>
  rollos: RolloExtraido[]
}

export type CodigoErrorExtraccion =
  | 'GEMINI_ERROR' // falla técnica no clasificada de Gemini
  | 'OPENROUTER_ERROR' // falla técnica no clasificada de OpenRouter
  | 'AI_ALL_PROVIDERS_FAILED' // fallaron todos los intentos disponibles
  | 'AI_QUOTA_EXCEEDED' // cuota/rate-limit del proveedor (429)
  | 'AI_OVERLOADED' // capacidad temporal del proveedor (503)
  | 'AI_TIMEOUT' // el proveedor no respondió dentro del límite local
  | 'AI_UNAVAILABLE' // error interno temporal del proveedor (5xx)
  | 'AI_MODEL_UNAVAILABLE' // modelo no disponible para el proyecto/API
  | 'JSON_INVALID' // la IA devolvió texto pero no parseó como JSON
  | 'NO_API_KEY' // API key del proveedor no configurada
  | 'FORMATO_INVALIDO' // la imagen no parece una planilla (0 rollos extraídos)
  | 'MISTRAL_ERROR'
  | 'OTHER'

export type ExtraccionResult =
  | { ok: true; data: IngresoExtraido }
  | { ok: false; error: string; codigo: CodigoErrorExtraccion }

/** Mistral realiza OCR y extracción estructurada en una sola solicitud. */
export async function extraerPlanilla(
  fileBuffer: Buffer,
  mimeType: string,
  customPrompt: string | null,
): Promise<ExtraccionResult> {
  const { extraerConMistral } = await import('./mistral')
  return extraerConMistral(fileBuffer, mimeType, customPrompt)
}

export { UMBRAL_BAJA_CONFIANZA } from './constantes'
