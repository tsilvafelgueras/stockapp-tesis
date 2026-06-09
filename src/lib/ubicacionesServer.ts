import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import {
  defaultUbicacionOptions,
  type UbicacionOption,
} from '@/lib/ubicaciones'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type UbicacionRow = {
  codigo: string
  descripcion: string | null
  tipo: string | null
  capacidad_rollos: number | null
  capacidad_kg: number | null
}

export async function getUbicacionesActivas(
  supabase: SupabaseClient
): Promise<UbicacionOption[]> {
  const { data, error } = await supabase
    .from('ubicaciones')
    .select('codigo, descripcion, tipo, capacidad_rollos, capacidad_kg')
    .eq('activa', true)
    .order('orden', { ascending: true })
    .order('codigo', { ascending: true })

  if (error) {
    if (isMissingUbicacionesTable(error)) return defaultUbicacionOptions()
    throw new Error(error.message)
  }

  const rows = (data ?? []) as UbicacionRow[]
  if (rows.length === 0) return defaultUbicacionOptions()

  return rows.map((u) => ({
    codigo: u.codigo,
    descripcion: u.descripcion,
    tipo: u.tipo,
    capacidadRollos: u.capacidad_rollos,
    capacidadKg: u.capacidad_kg,
  }))
}

export async function validarUbicacionActiva(
  supabase: SupabaseClient,
  codigo: string
): Promise<{ ok: true; codigo: string } | { ok: false; error: string }> {
  const clean = codigo.trim()
  if (!clean) {
    return { ok: false, error: 'La ubicacion no puede estar vacia.' }
  }

  const { data, error } = await supabase
    .from('ubicaciones')
    .select('codigo')
    .eq('codigo', clean)
    .eq('activa', true)
    .maybeSingle()

  if (error) {
    if (isMissingUbicacionesTable(error)) {
      const fallback = defaultUbicacionOptions().some((u) => u.codigo === clean)
      return fallback
        ? { ok: true, codigo: clean }
        : { ok: false, error: 'Elegí una ubicacion del desplegable.' }
    }
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: false, error: 'Elegí una ubicacion activa del desplegable.' }
  }

  return { ok: true, codigo: clean }
}

function isMissingUbicacionesTable(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    /relation .*ubicaciones.* does not exist/i.test(error.message ?? '')
  )
}
