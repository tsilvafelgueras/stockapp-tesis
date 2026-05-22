'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ClienteInput = {
  nombre: string
  contacto?: string
  email?: string
  telefono?: string
  direccion?: string
  notas?: string
}

export type ClienteResult =
  | { ok: true; cliente: { id: string; nombre: string } }
  | { ok: false; error: string }

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

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre,
      contacto: input.contacto?.trim() || null,
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
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

  revalidatePath('/ventas/clientes')
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

  const { data, error } = await supabase
    .from('clientes')
    .update({
      nombre,
      contacto: input.contacto?.trim() || null,
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      direccion: input.direccion?.trim() || null,
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

  revalidatePath('/ventas/clientes')
  revalidatePath(`/ventas/clientes/${id}`)
  return { ok: true, cliente: data }
}

export async function toggleClienteActivo(
  id: string,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, error: authError } = await requireVentasOAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from('clientes')
    .update({ activo })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/ventas/clientes')
  revalidatePath(`/ventas/clientes/${id}`)
  return { ok: true }
}
