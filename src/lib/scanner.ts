/**
 * Extrae el código de pieza del texto que devolvió el lector de QR/barcode.
 *
 * Los rollos de algunas tintorerías traen QRs con info extra después del
 * número (ej. "342526 MIC LY 40 TER FR NEGRO 9001 21.40"). Para identificar
 * el rollo solo nos importa el primer token: todo lo que está antes del
 * primer espacio en blanco.
 */
export function extraerCodigoRollo(raw: string): string {
  return raw.trim().split(/\s+/)[0] ?? ''
}
