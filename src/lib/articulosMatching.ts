export type ArticuloCatalogo = { id: string; nombre: string }

function normalizarArticulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function tokens(valor: string): string[] {
  return valor.split(/\W+/).filter((token) => token.length >= 2)
}

function casiIgual(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let diferencias = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++diferencias > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  if (i < a.length || j < b.length) diferencias++
  return diferencias <= 1
}

function tokenCoincide(catalogo: string, extraido: string): boolean {
  if (catalogo === extraido) return true
  if (catalogo.length >= 3 && extraido.startsWith(catalogo)) return true
  if (extraido.length >= 3 && catalogo.startsWith(extraido)) return true
  return (
    Math.min(catalogo.length, extraido.length) >= 4 &&
    casiIgual(catalogo, extraido)
  )
}

/**
 * Resuelve el nombre/código extraído contra artículos existentes. Tolera texto
 * adicional y errores mínimos, pero exige que coincida la mayoría de los
 * tokens del artículo para no asignar uno ambiguo.
 */
export function resolverArticuloCatalogo(
  raw: string | null | undefined,
  articulos: ArticuloCatalogo[]
): string | null {
  const texto = normalizarArticulo(raw ?? '')
  if (!texto) return null
  const tokensTexto = tokens(texto)
  const catalogo = articulos
    .map((articulo) => ({
      articulo,
      nombre: normalizarArticulo(articulo.nombre),
      tokens: tokens(normalizarArticulo(articulo.nombre)),
    }))
    .filter(({ nombre }) => nombre)

  const exacto = catalogo.find(({ nombre }) => nombre === texto)
  if (exacto) return exacto.articulo.id

  // Muchas planillas imprimen solamente el código de una denominación más
  // larga ("ML70" para "ML70 Frisada"). Lo aceptamos únicamente cuando ese
  // token identifica un solo artículo del catálogo.
  if (tokensTexto.length === 1 && tokensTexto[0].length >= 3) {
    const porCodigo = catalogo.filter(({ tokens: tokensCatalogo }) =>
      tokensCatalogo.some((tokenCatalogo) =>
        tokenCoincide(tokenCatalogo, tokensTexto[0])
      )
    )
    if (porCodigo.length === 1) return porCodigo[0].articulo.id
  }

  const candidatos = catalogo
    .map(({ articulo, nombre, tokens: tokensCatalogo }) => {
      const coincidencias = tokensCatalogo.filter((tokenCatalogo) =>
        tokensTexto.some((tokenTexto) =>
          tokenCoincide(tokenCatalogo, tokenTexto)
        )
      ).length
      // Cuántos tokens del texto extraído están cubiertos por el catálogo:
      // permite matchear una abreviatura de la planilla contenida en un nombre
      // canónico más largo (ej. "JERSEY ALGODÓN" ⊆ "JERSEY 30/1 ALGODÓN PEINADO").
      const cubiertosTexto = tokensTexto.filter((tokenTexto) =>
        tokensCatalogo.some((tokenCatalogo) =>
          tokenCoincide(tokenCatalogo, tokenTexto)
        )
      ).length
      return {
        articulo,
        nombre,
        total: tokensCatalogo.length,
        coincidencias,
        ratioCatalogo: coincidencias / tokensCatalogo.length,
        coberturaTexto: tokensTexto.length
          ? cubiertosTexto / tokensTexto.length
          : 0,
      }
    })
    .filter(
      (candidato) =>
        candidato.total > 0 &&
        candidato.coincidencias >= 1 &&
        (candidato.ratioCatalogo >= 0.6 || candidato.coberturaTexto === 1)
    )
    .sort(
      (a, b) =>
        b.coincidencias - a.coincidencias ||
        b.ratioCatalogo - a.ratioCatalogo ||
        b.coberturaTexto - a.coberturaTexto ||
        b.nombre.length - a.nombre.length
    )

  const mejor = candidatos[0]
  if (!mejor) return null

  // La vía laxa (cobertura del texto extraído) solo se acepta si el mejor
  // candidato es único en coincidencias: si hay otro empatado, es ambiguo y
  // preferimos no adivinar (que el usuario elija) antes que asignar mal.
  if (
    mejor.ratioCatalogo < 0.6 &&
    candidatos[1]?.coincidencias === mejor.coincidencias
  ) {
    return null
  }

  return mejor.articulo.id
}
