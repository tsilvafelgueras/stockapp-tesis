'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ClienteInput = {
  nombre: string
  cuit_cuil?: string
  contacto?: string
  email?: string
  telefono?: string
  direccion?: string
  condicion_pago?: string
  categoria_precio?: string
  estado_cliente?: string
  vendedor_asignado?: string
  notas?: string
}

export type ClienteResult =
  | { ok: true; cliente: { id: string; nombre: string } }
  | { ok: false; error: string }

export type SimpleResult = { ok: true } | { ok: false; error: string }

async function requireVentasOAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Sesión expirada — volvé a entrar.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ventas' && profile?.role !== 'admin') {
    return {
      supabase,
      error: 'Solo ventas o admin pueden gestionar clientes.',
    }
  }
  return { supabase, user, error: null as string | null }
}

export async function crearCliente(input: ClienteInput): Promise<ClienteResult> {
  const { supabase, error: authError } = await requireVentasOAdmin()
  if (authError) return { ok: false, error: authError }

  const nombre = input.nombre.trim()
  if (!nombre) return { ok: false, error: 'El nombre del cliente es obligatorio.' }
  const cuitCuil = normalizarCuitCuil(input.cuit_cuil)
  if (cuitCuil.error) return { ok: false, error: cuitCuil.error }
  const estadoCliente = normalizarEstadoCliente(input.estado_cliente)

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre,
      cuit_cuil: cuitCuil.value,
      contacto: input.contacto?.trim() || null,
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
      condicion_pago: normalizarOpcion(input.condicion_pago),
      categoria_precio: normalizarOpcion(input.categoria_precio),
      estado_cliente: estadoCliente,
      activo: estadoCliente !== 'inactivo',
      vendedor_asignado: input.vendedor_asignado?.trim() || null,
      notas: input.notas?.trim() || null,
    })
    .select('id, nombre')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: `Ya existe un cliente con el nombre "${nombre}".`,
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/clientes')
  return { ok: true, cliente: data }
}

export async function editarCliente(
  id: string,
  input: ClienteInput
): Promise<ClienteResult> {
  const { supabase, error: authError } = await requireVentasOAdmin()
  if (authError) return { ok: false, error: authError }

  const nombre = input.nombre.trim()
  if (!nombre) return { ok: false, error: 'El nombre del cliente es obligatorio.' }
  const cuitCuil = normalizarCuitCuil(input.cuit_cuil)
  if (cuitCuil.error) return { ok: false, error: cuitCuil.error }
  const estadoCliente = normalizarEstadoCliente(input.estado_cliente)

  const { data, error } = await supabase
    .from('clientes')
    .update({
      nombre,
      cuit_cuil: cuitCuil.value,
      contacto: input.contacto?.trim() || null,
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
      condicion_pago: normalizarOpcion(input.condicion_pago),
      categoria_precio: normalizarOpcion(input.categoria_precio),
      estado_cliente: estadoCliente,
      activo: estadoCliente !== 'inactivo',
      vendedor_asignado: input.vendedor_asignado?.trim() || null,
      notas: input.notas?.trim() || null,
    })
    .eq('id', id)
    .select('id, nombre')
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: `Ya existe otro cliente con el nombre "${nombre}".`,
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { ok: true, cliente: data }
}

export async function toggleClienteActivo(
  id: string,
  activo: boolean
): Promise<SimpleResult> {
  const { supabase, error: authError } = await requireVentasOAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from('clientes')
    .update({
      activo,
      estado_cliente: activo ? 'activo' : 'inactivo',
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { ok: true }
}

export async function eliminarCliente(id: string): Promise<SimpleResult> {
  const { supabase, error: authError } = await requireVentasOAdmin()
  if (authError) return { ok: false, error: authError }

  const [{ count: pedidosCount }, { count: demandasCount }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', id),
    supabase
      .from('pedidos_pendientes')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', id),
  ])

  if ((pedidosCount ?? 0) > 0 || (demandasCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        'No se puede eliminar un cliente con pedidos o demandas. Desactivalo para ocultarlo sin perder historial.',
    }
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { ok: true }
}

function normalizarOpcion(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizarEstadoCliente(value: string | undefined): string {
  const estado = value?.trim() || 'activo'
  if (estado === 'activo' || estado === 'inactivo' || estado === 'potencial') {
    return estado
  }
  return 'activo'
}

function normalizarCuitCuil(
  value: string | undefined
): { value: string | null; error?: string } {
  const trimmed = value?.trim()
  if (!trimmed) return { value: null }
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: 'CUIT/CUIL debe contener solo numeros.' }
  }
  return { value: trimmed }
}
