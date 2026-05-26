// Constantes y tipos compartidos entre server actions (actions.ts) y
// componentes cliente (StockList, RolloDetailDialog). NO va en actions.ts
// porque ese archivo tiene 'use server' y Next solo permite exports de
// funciones async desde ahí — cualquier constante exportada queda como
// `undefined` en el bundle del cliente y rompe en runtime con
// "x.includes is not a function" / similar.

export const FALLA_CATEGORIAS = [
  'mancha',
  'agujero',
  'color_disparejo',
  'tono_diferente',
  'rotura_tejido',
  'otro',
] as const
export type FallaCategoria = (typeof FALLA_CATEGORIAS)[number]

export const FALLA_CATEGORIA_LABEL: Record<FallaCategoria, string> = {
  mancha: 'Mancha',
  agujero: 'Agujero',
  color_disparejo: 'Color disparejo',
  tono_diferente: 'Tono diferente',
  rotura_tejido: 'Rotura de tejido',
  otro: 'Otro',
}

// Estados que se pueden setear desde el form de edición. "reservado" /
// "entregado" no se exponen porque dependen de pedidos/picking. "baja" sí
// se permite — algunos usuarios prefieren dar de baja desde el form en
// lugar de usar el botón dedicado.
export const ESTADOS_EDITABLES = [
  'pendiente',
  'en_stock',
  'segunda',
  'baja',
] as const
export type EstadoEditable = (typeof ESTADOS_EDITABLES)[number]
