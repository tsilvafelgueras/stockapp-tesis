'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type UbicacionInput = {
  codigo: string
  descripcion?: string
  tipo: string
  capacidadRollos?: string
  capacidadKg?: string
  orden?: string
  activa?: boolean
}

export type UbicacionActionResult =
  | { ok: true }
  | { ok: false; error: string }

export async function crearUbicacion(
  input: UbicacionInput
): Promise<UbicacionActionResult> {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  if (!admin.ok) return admin

  const parsed = parseUbicacionInput(input)
  if (!parsed.ok) return parsed

  const { error } = await supabase.from('ubicaciones').insert(parsed.data)
  if (error) return { ok: false, error: friendlyUbicacionError(error) }

  revalidatePath('/admin/ubicaciones')
  revalidatePath('/stock')
  return { ok: true }
}

export async function actualizarUbicacion(
  id: string,
  input: UbicacionInput
): Promise<UbicacionActionResult> {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  if (!admin.ok) return admin

  const parsed = parseUbicacionInput(input)
  if (!parsed.ok) return parsed

  const { error } = await supabase
    .from('ubicaciones')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: friendlyUbicacionError(error) }

  revalidatePath('/admin/ubicaciones')
  revalidatePath('/stock')
  return { ok: true }
}

export async function toggleUbicacion(
  id: string,
  activa: boolean
): Promise<UbicacionActionResult> {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  if (!admin.ok) return admin

  const { error } = await supabase
    .from('ubicaciones')
    .update({ activa, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/ubicaciones')
  revalidatePath('/stock')
  return { ok: true }
}

async function assertAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesion expirada.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { ok: false, error: 'Solo el admin puede gestionar ubicaciones.' }
  }

  return { ok: true }
}

function parseUbicacionInput(
  input: UbicacionInput
):
  | {
      ok: true
      data: {
        codigo: string
        descripcion: string | null
        tipo: string
        capacidad_rollos: number | null
        capacidad_kg: number | null
        orden: number
        activa: boolean
      }
    }
  | { ok: false; error: string } {
  const codigo = input.codigo.trim()
  if (!codigo) return { ok: false, error: 'El codigo es obligatorio.' }
  if (codigo.length > 50) {
    return { ok: false, error: 'El codigo no puede superar 50 caracteres.' }
  }

  const tipo = input.tipo || 'general'
  if (
    !['general', 'rack', 'piso', 'preparacion', 'devolucion', 'otro'].includes(
      tipo
    )
  ) {
    return { ok: false, error: 'Tipo de ubicacion invalido.' }
  }

  const capacidadRollos = parseOptionalNumber(input.capacidadRollos)
  if (capacidadRollos.error) return { ok: false, error: capacidadRollos.error }
  const capacidadKg = parseOptionalNumber(input.capacidadKg)
  if (capacidadKg.error) return { ok: false, error: capacidadKg.error }
  const orden = Number.parseInt(input.orden || '0', 10)

  return {
    ok: true,
    data: {
      codigo,
      descripcion: input.descripcion?.trim() || null,
      tipo,
      capacidad_rollos: capacidadRollos.value,
      capacidad_kg: capacidadKg.value,
      orden: Number.isFinite(orden) ? orden : 0,
      activa: input.activa ?? true,
    },
  }
}

function parseOptionalNumber(raw?: string) {
  const clean = raw?.trim().replace(',', '.') ?? ''
  if (!clean) return { value: null as number | null, error: null }
  const value = Number(clean)
  if (!Number.isFinite(value) || value < 0) {
    return { value: null, error: 'Las capacidades deben ser numeros positivos.' }
  }
  return { value, error: null }
}

function friendlyUbicacionError(error: { code?: string; message: string }) {
  if (error.code === '23505') return 'Ya existe una ubicacion con ese codigo.'
  return error.message
}
