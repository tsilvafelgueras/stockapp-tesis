export type RolloConArticuloSugerido = {
  articulo_id?: string | null
  articulo_nombre_sugerido?: string
}

export function claveArticuloSugerido(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

export function agruparArticulosSinAsignar(rollos: RolloConArticuloSugerido[]) {
  const grupos = new Map<string, { clave: string; nombre: string; cantidad: number }>()
  for (const rollo of rollos) {
    if (rollo.articulo_id || !rollo.articulo_nombre_sugerido?.trim()) continue
    const nombre = rollo.articulo_nombre_sugerido.trim().replace(/\s+/g, ' ')
    const clave = claveArticuloSugerido(nombre)
    const grupo = grupos.get(clave)
    if (grupo) grupo.cantidad++
    else grupos.set(clave, { clave, nombre, cantidad: 1 })
  }
  return [...grupos.values()]
}
