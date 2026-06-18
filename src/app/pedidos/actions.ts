'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CrearPedidoResult =
  | { ok: true; pedidoId: string }
  | { ok: false; error: string }

export type PedidoPartidaInput = {
  ingresoId: string
  articuloId: string
  colorId: string
  cantidad: number
}

export async function crearPedidoPorPartidas(
  clienteId: string,
  numeroRemitoExterno: string,
  partidas: PedidoPartidaInput[],
  fechaEntregaComprometida: string
): Promise<CrearPedidoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesion expiro. Volve a entrar.' }

  if (!clienteId) {
    return { ok: false, error: 'Elegi un cliente del catalogo.' }
  }

  const items = partidas
    .map((p) => ({
      ingreso_id: p.ingresoId,
      articulo_id: p.articuloId,
      color_id: p.colorId,
      cantidad: Math.trunc(Number(p.cantidad)),
    }))
    .filter(
      (p) =>
        p.ingreso_id &&
        p.articulo_id &&
        p.color_id &&
        Number.isFinite(p.cantidad) &&
        p.cantidad > 0
    )

  if (items.length === 0) {
    return { ok: false, error: 'Tenes que seleccionar al menos una partida.' }
  }

  const { data, error } = await supabase.rpc('crear_pedido_por_partidas', {
    p_cliente_id: clienteId,
    p_numero_remito_externo: numeroRemitoExterno.trim() || null,
    p_items: items,
    p_fecha_entrega_comprometida: fechaEntregaComprometida || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/pedidos')
  revalidatePath('/picking')
  revalidatePath('/stock')
  return { ok: true, pedidoId: data as string }
}

export type SimpleResult = { ok: true } | { ok: false; error: string }

function buildPedidoItems(partidas: PedidoPartidaInput[]) {
  return partidas
    .map((p) => ({
      ingreso_id: p.ingresoId,
      articulo_id: p.articuloId,
      color_id: p.colorId,
      cantidad: Math.trunc(Number(p.cantidad)),
    }))
    .filter(
      (p) =>
        p.ingreso_id &&
        p.articulo_id &&
        p.color_id &&
        Number.isFinite(p.cantidad) &&
        p.cantidad > 0
    )
}

export async function actualizarPedidoRemito(
  pedidoId: string,
  numeroRemitoExterno: string
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('actualizar_pedido_remito', {
    p_pedido_id: pedidoId,
    p_numero_remito_externo: numeroRemitoExterno.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath(`/clientes`)
  return { ok: true }
}

export async function agregarPartidasAPedido(
  pedidoId: string,
  partidas: PedidoPartidaInput[]
): Promise<SimpleResult> {
  const supabase = await createClient()
  const items = buildPedidoItems(partidas)
  if (items.length === 0) {
    return { ok: false, error: 'Tenes que seleccionar al menos una partida.' }
  }

  const { error } = await supabase.rpc('agregar_partidas_a_pedido', {
    p_pedido_id: pedidoId,
    p_items: items,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/picking/${pedidoId}`)
  revalidatePath('/stock')
  return { ok: true }
}

export type QuitarRolloPedidoResult =
  | { ok: true; numeroPieza: string; pendientes: number; total: number }
  | { ok: false; error: string }

// Ventas/admin quitan un rollo ya pickeado: vuelve a stock como 'Sin ubicar' y
// el operario recibe una notificación para reubicarlo.
export async function liberarRolloDePedido(input: {
  pedidoId: string
  pedidoRolloId: string
  motivo?: string
}): Promise<QuitarRolloPedidoResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('liberar_rollo_de_pedido', {
    p_pedido_id: input.pedidoId,
    p_pedido_rollo_id: input.pedidoRolloId,
    p_motivo: input.motivo?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  const json = data as {
    numero_pieza: string
    pendientes: number
    total: number
  }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${input.pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/picking/${input.pedidoId}`)
  revalidatePath('/stock')
  return {
    ok: true,
    numeroPieza: json.numero_pieza,
    pendientes: json.pendientes,
    total: json.total,
  }
}

// Ventas/admin quitan una línea de demanda entera: libera sus rollos pickeados
// (cada uno notifica al operario) y elimina la línea solicitada.
export async function quitarPartidaDePedido(input: {
  pedidoId: string
  pedidoPartidaId: string
  motivo?: string
}): Promise<
  | { ok: true; rollosLiberados: number; pendientes: number; total: number }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('quitar_partida_de_pedido', {
    p_pedido_partida_id: input.pedidoPartidaId,
    p_motivo: input.motivo?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  const json = data as {
    rollos_liberados: number
    pendientes: number
    total: number
  }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${input.pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/picking/${input.pedidoId}`)
  revalidatePath('/stock')
  return {
    ok: true,
    rollosLiberados: json.rollos_liberados,
    pendientes: json.pendientes,
    total: json.total,
  }
}

export async function cancelarPedido(
  pedidoId: string,
  motivoCaida = '',
  comentario = '',
  ubicacionReasignacion = 'A ordenar'
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_pedido', {
    p_pedido_id: pedidoId,
    p_motivo_caida: motivoCaida || null,
    p_comentario: comentario || null,
    p_ubicacion_reasignacion: ubicacionReasignacion || 'A ordenar',
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/picking')
  revalidatePath('/stock')
  return { ok: true }
}

export async function confirmarEgresoPedido(
  pedidoId: string,
  comentario = '',
  numeroRemitoSalida = ''
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_egreso_pedido', {
    p_pedido_id: pedidoId,
    p_comentario: comentario || null,
    p_numero_remito_salida: numeroRemitoSalida || null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/picking/${pedidoId}`)
  revalidatePath('/stock')
  return { ok: true }
}
