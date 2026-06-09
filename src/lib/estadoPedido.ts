// Fuente única de verdad para el label + color de cada estado de pedido.
// Antes este mapa estaba duplicado en pedidos/page.tsx y pedidos/[id]/page.tsx
// con colisiones de color (confirmada_egreso == en_preparacion) y un texto
// incorrecto en "entregada". Centralizado para mantener consistencia.
//
// Paleta: cada estado tiene un color distinguible siguiendo el ciclo de vida.
export type EstadoPedido =
  | 'pendiente'
  | 'en_preparacion'
  | 'lista'
  | 'confirmada_egreso'
  | 'entregada'
  | 'cancelada'

export type EstadoBadge = { text: string; className: string }

export const ESTADO_PEDIDO_LABEL: Record<string, EstadoBadge> = {
  pendiente: { text: 'Pendiente', className: 'bg-zinc-100 text-zinc-700' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-warning/15 text-warning',
  },
  lista: { text: 'Pedido listo', className: 'bg-indigo-100 text-indigo-700' },
  confirmada_egreso: {
    text: 'Egreso confirmado',
    className: 'bg-primary/15 text-primary',
  },
  entregada: { text: 'Entregado', className: 'bg-success/15 text-success' },
  cancelada: {
    text: 'Cancelada',
    className: 'bg-destructive/15 text-destructive',
  },
}

/** Devuelve el badge del estado, con fallback seguro a "pendiente". */
export function estadoPedidoBadge(estado: string): EstadoBadge {
  return ESTADO_PEDIDO_LABEL[estado] ?? ESTADO_PEDIDO_LABEL.pendiente
}
