const racks = ['A', 'B', 'C', 'D', 'E', 'F']

export type UbicacionOption = {
  codigo: string
  descripcion: string | null
  tipo: string | null
  capacidadRollos?: number | null
  capacidadKg?: number | null
}

export const DEFAULT_UBICACIONES: string[] = [
  'A ordenar',
  'Sin ubicar',
  ...racks.flatMap((rack) =>
    Array.from({ length: 30 }, (_, i) => `${rack}${i + 1}`)
  ),
]

export const UBICACIONES = DEFAULT_UBICACIONES

export function ubicacionesToOptions(ubicaciones: UbicacionOption[]) {
  return ubicaciones.map((u) => ({
    value: u.codigo,
    label: u.codigo,
    description: u.descripcion ?? tipoUbicacionLabel(u.tipo) ?? undefined,
  }))
}

export function defaultUbicacionOptions(): UbicacionOption[] {
  return DEFAULT_UBICACIONES.map((codigo) => ({
    codigo,
    descripcion: null,
    tipo: codigo.match(/^[A-F][0-9]+$/) ? 'rack' : 'general',
  }))
}

function tipoUbicacionLabel(tipo: string | null) {
  switch (tipo) {
    case 'rack':
      return 'Rack'
    case 'piso':
      return 'Piso'
    case 'preparacion':
      return 'Preparación'
    case 'devolucion':
      return 'Devolución'
    case 'otro':
      return 'Otra ubicación'
    default:
      return null
  }
}
