'use server'

import { createClient } from '@/lib/supabase/server'

export type RolloSinEtiquetaInput = {
  kilos: number
  ubicacion?: string
}

export type CreateRollosInput =
  | {
      modo: 'existente'
      ingreso_id: string
      articulo_id: string
      color_id: string
      rollos: RolloSinEtiquetaInput[]
    }
  | {
      modo: 'nuevo'
      ot?: string
      tintoreria_id: string
      fecha_despacho: string
      articulo_id: string
      color_id: string
      rollos: RolloSinEtiquetaInput[]
    }

export type CreateRollosResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string }

export type DatosPartidaResult =
  | { ok: true; articulo_id: string; articulo_nombre: string; color_id: string; color_nombre: string }
  | { ok: true; sin_rollos: true }
  | { ok: false; error: string }

export async function obtenerDatosPartida(ingreso_id: string): Promise<DatosPartidaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  if (!profile?.empresa_id) return { ok: false, error: 'Sin empresa asignada.' }

  const { data: rollo } = await supabase
    .from('rollos')
    .select('articulo_id, color_id, articulos(nombre), colores(nombre)')
    .eq('ingreso_id', ingreso_id)
    .eq('empresa_id', profile.empresa_id)
    .limit(1)
    .maybeSingle()

  if (!rollo) return { ok: true, sin_rollos: true }

  type RolloWithJoins = {
    articulo_id: string
    color_id: string
    articulos: { nombre: string } | null
    colores: { nombre: string } | null
  }
  const r = rollo as unknown as RolloWithJoins
  return {
    ok: true,
    articulo_id: r.articulo_id,
    articulo_nombre: r.articulos?.nombre ?? '',
    color_id: r.color_id,
    color_nombre: r.colores?.nombre ?? '',
  }
}

export async function createRollosSinEtiqueta(
  input: CreateRollosInput
): Promise<CreateRollosResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada — volvé a iniciar sesión.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.empresa_id) return { ok: false, error: 'Tu usuario no tiene empresa asignada.' }
  if (profile.role !== 'operario' && profile.role !== 'admin') {
    return { ok: false, error: 'No tenés permiso para esta acción.' }
  }

  if (!input.rollos.length) return { ok: false, error: 'Agregá al menos un rollo.' }
  for (const r of input.rollos) {
    if (!r.kilos || r.kilos <= 0) return { ok: false, error: 'Los kilos deben ser mayores a cero.' }
  }

  let ingreso_id: string

  if (input.modo === 'existente') {
    // Verificar que el ingreso pertenece a la empresa
    const { data: ingreso } = await supabase
      .from('ingresos')
      .select('id')
      .eq('id', input.ingreso_id)
      .eq('empresa_id', profile.empresa_id)
      .maybeSingle()
    if (!ingreso) return { ok: false, error: 'Partida no encontrada.' }
    ingreso_id = input.ingreso_id
  } else {
    // Crear ingreso — el trigger trg_ingresos_numero_lote asigna numero_lote automáticamente
    const { data: ingreso, error: iError } = await supabase
      .from('ingresos')
      .insert({
        tintoreria_id: input.tintoreria_id,
        fecha_despacho: input.fecha_despacho,
        ot: input.ot?.trim() || null,
        estado: 'confirmado',
        origen: 'manual',
      })
      .select('id')
      .single()

    if (iError || !ingreso) {
      return { ok: false, error: `No se pudo crear la partida: ${iError?.message}` }
    }
    ingreso_id = ingreso.id
  }

  // Encontrar los primeros N enteros positivos disponibles para la empresa
  const { data: rollosExistentes } = await supabase
    .from('rollos')
    .select('numero_pieza')
    .eq('empresa_id', profile.empresa_id)

  const numerosUsados = new Set(
    (rollosExistentes ?? [])
      .map((r) => parseInt(r.numero_pieza as string))
      .filter((n) => !isNaN(n) && n > 0)
  )

  const libres: number[] = []
  let candidato = 1
  while (libres.length < input.rollos.length) {
    if (!numerosUsados.has(candidato)) libres.push(candidato)
    candidato++
  }

  const rollosToInsert = input.rollos.map((r, i) => ({
    ingreso_id,
    empresa_id: profile.empresa_id,
    articulo_id: input.articulo_id,
    color_id: input.color_id,
    numero_pieza: String(libres[i]),
    kilos: r.kilos,
    ubicacion: r.ubicacion?.trim() || null,
    estado: 'en_stock' as const,
  }))

  const { data: inserted, error: rError } = await supabase
    .from('rollos')
    .insert(rollosToInsert)
    .select('id')

  if (rError) {
    if (input.modo === 'nuevo') {
      await supabase.from('ingresos').delete().eq('id', ingreso_id)
    }
    if (rError.code === '23505') {
      return { ok: false, error: 'Conflicto de número de pieza, intentá de nuevo.' }
    }
    if (rError.code === '23503') {
      return { ok: false, error: 'La combinación artículo-color no está asociada. Pedile al admin que la configure.' }
    }
    return { ok: false, error: `No se pudieron guardar los rollos: ${rError.message}` }
  }

  return { ok: true, ids: (inserted ?? []).map((r) => r.id) }
}
