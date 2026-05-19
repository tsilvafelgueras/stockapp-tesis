/**
 * Extrae el codigo de pieza del texto que devolvio el lector de QR/barcode.
 *
 * Cuando la pantalla conoce los codigos posibles, se prioriza un match exacto
 * dentro del payload completo del QR. Esto evita tomar otro numero del remito,
 * OT, kilos u otros datos cuando el QR trae mas informacion que la pieza.
 */
export function extraerCodigoRollo(
  raw: string,
  codigosEsperados: string[] = []
): string {
  const texto = normalizarTexto(raw)
  if (!texto) return ''

  const esperado = buscarCodigoEsperado(texto, codigosEsperados)
  if (esperado) return esperado

  return texto.split(/\s+/)[0] ?? ''
}

function buscarCodigoEsperado(
  texto: string,
  codigosEsperados: string[]
): string | null {
  const textoComparacion = texto.toUpperCase()
  const codigos = codigosEsperados
    .map((codigo) => normalizarTexto(codigo))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  for (const codigo of codigos) {
    const patron = new RegExp(
      `(^|[^A-Z0-9])${escapeRegExp(codigo.toUpperCase())}(?=$|[^A-Z0-9])`
    )
    if (patron.test(textoComparacion)) return codigo
  }

  return null
}

function normalizarTexto(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
