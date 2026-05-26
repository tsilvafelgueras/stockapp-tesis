'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  extraerPlanilla,
  type IngresoExtraido,
  UMBRAL_BAJA_CONFIANZA,
} from '@/lib/extraccion/extraerPlanilla'
import { subirPlanilla } from '@/lib/storage/planillas'
import { normalizarTitleCase } from '@/lib/text/normalize'

// ── Tipos del flow manual + IA ─────────────────────────────

export type RolloInput = {
  numero_pieza: string
  kilos: string
  metros: string
  ratio_rendimiento: string
  gramaje_planilla?: string
  ubicacion: string
  estado: 'en_stock' | 'pendiente'
  /** Artículo del rollo. Una planilla puede tener varios artículos distintos. */
  articulo_id?: string | null
  /** Color del rollo. Una planilla puede tener varios colores distintos. */
  color?: string | null
  /** Confianza promedio reportada por la IA para este rollo (0-1). Solo se setea en flow IA. */
  confianza_ia?: number
}

export type IngresoInput = {
  tintoreria_id: string
  fecha: string
  numero_remito: string
  ot?: string
  rem_tejeduria?: string
  referencia?: string
  total_rollos_declarado: string
  total_kilos_declarado: string
  /** Path en Storage (bucket planillas) si vino por flow IA. */
  imagen_path?: string
  origen?: 'manual' | 'planilla_ia'
  rollos: RolloInput[]
}

// ── Server action: procesar planilla con IA ────────────────

export type ProcesarPlanillaResult =
  | {
      ok: true
      imagen_path: string
      datos: IngresoExtraido
      warnings: string[]
    }
  | {
      ok: false
      error: string
      codigo:
        | 'NO_FILE'
        | 'NO_TINTORERIA'
        | 'TIPO_INVALIDO'
        | 'NO_AUTH'
        | 'SIN_EMPRESA'
        | 'STORAGE_ERROR'
        | 'GEMINI_ERROR'
        | 'JSON_INVALID'
        | 'NO_API_KEY'
        | 'FORMATO_INVALIDO'
        | 'OTHER'
      /** Si la imagen ya se subió pero la IA falló, devolvemos el path para reintento. */
      imagen_path?: string
    }

const MIME_ACEPTADOS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]

/**
 * Procesa una planilla con IA aplicando el prompt custom de la tintorería
 * elegida. Si la tintorería no tiene `extraction_prompt`, usa el default.
 */
export async function procesarPlanillaConIA(
  formData: FormData
): Promise<ProcesarPlanillaResult> {
  const file = formData.get('archivo')
  const tintoreriaId = formData.get('tintoreria_id')

  if (!(file instanceof File)) {
    return { ok: false, error: 'No se recibió archivo.', codigo: 'NO_FILE' }
  }
  if (typeof tintoreriaId !== 'string' || !tintoreriaId.trim()) {
    return {
      ok: false,
      error: 'Hay que seleccionar la tintorería antes de subir la planilla.',
      codigo: 'NO_TINTORERIA',
    }
  }
  if (!MIME_ACEPTADOS.includes(file.type)) {
    return {
      ok: false,
      error: `Tipo de archivo no soportado: ${file.type}. Aceptamos JPG, PNG, WebP, HEIC y PDF.`,
      codigo: 'TIPO_INVALIDO',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada — volvé a iniciar sesión.', codigo: 'NO_AUTH' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  if (!profile?.empresa_id) {
    return {
      ok: false,
      error: 'Tu usuario no tiene empresa asignada.',
      codigo: 'SIN_EMPRESA',
    }
  }

  // Lookup del prompt custom de la tintorería elegida.
  // Si no tiene `extraction_prompt`, queda null y se usa el default.
  const { data: tintoreria } = await supabase
    .from('tintorerias')
    .select('extraction_prompt')
    .eq('id', tintoreriaId)
    .single()

  const customPrompt = tintoreria?.extraction_prompt ?? null

  const buffer = Buffer.from(await file.arrayBuffer())

  const upload = await subirPlanilla(buffer, file.type, profile.empresa_id)
  if (!upload.ok) {
    return { ok: false, error: upload.error, codigo: 'STORAGE_ERROR' }
  }

  const extraccion = await extraerPlanilla(buffer, file.type, customPrompt)
  if (!extraccion.ok) {
    return {
      ok: false,
      error: extraccion.error,
      codigo: extraccion.codigo,
      imagen_path: upload.path,
    }
  }

  const warnings = calcularWarnings(extraccion.data)

  return {
    ok: true,
    imagen_path: upload.path,
    datos: extraccion.data,
    warnings,
  }
}

/** Banners de fallback 3-tier: incompleto + calidad pobre. (Falla técnica se maneja arriba.) */
function calcularWarnings(data: IngresoExtraido): string[] {
  const warnings: string[] = []

  const declarados = data.total_rollos_declarado.value
  const extraidos = data.rollos.length
  if (declarados !== null && declarados !== extraidos) {
    if (extraidos < declarados) {
      warnings.push(
        `La planilla declara ${declarados} rollos pero la IA extrajo solo ${extraidos}. Agregá los ${declarados - extraidos} faltantes a mano antes de guardar.`
      )
    } else {
      warnings.push(
        `La planilla declara ${declarados} rollos pero la IA extrajo ${extraidos}. Revisá si hay duplicados.`
      )
    }
  }

  const todasLasCeldas: number[] = []
  for (const k of [
    'numero_remito',
    'fecha',
    'color',
    'ot',
    'rem_tejeduria',
    'referencia',
    'total_rollos_declarado',
    'total_kilos_declarado',
  ] as const) {
    todasLasCeldas.push(data[k].confidence)
  }
  for (const r of data.rollos) {
    todasLasCeldas.push(
      r.numero_pieza.confidence,
      r.kilos.confidence,
      r.metros.confidence,
      r.ratio.confidence,
      r.gramaje_planilla.confidence,
      r.articulo?.confidence ?? 1
    )
  }
  const bajas = todasLasCeldas.filter((c) => c < UMBRAL_BAJA_CONFIANZA).length
  const pctBajas = todasLasCeldas.length > 0 ? bajas / todasLasCeldas.length : 0
  if (pctBajas > 0.3) {
    warnings.push(
      `La IA detectó muchos campos con baja confianza (${Math.round(pctBajas * 100)}%). Te recomendamos revisar cuidadosamente o cargar a mano.`
    )
  }

  return warnings
}

// ── Server action: crear ingreso (flow manual o IA) ────────

export async function crearIngreso(input: IngresoInput) {
  const supabase = await createClient()

  if (!input.tintoreria_id) return { error: 'Falta seleccionar la tintorería.' }
  if (!input.fecha) return { error: 'Falta la fecha del ingreso.' }
  if (!input.rollos.length) return { error: 'Cargá al menos un rollo.' }

  const origen = input.origen ?? 'manual'

  for (const r of input.rollos) {
    if (!r.numero_pieza.trim()) {
      return { error: 'Todos los rollos deben tener número de pieza.' }
    }
    if (!r.articulo_id) {
      return { error: `El rollo "${r.numero_pieza.trim()}" no tiene artículo asignado.` }
    }
    if (!r.color?.trim()) {
      return { error: `El rollo "${r.numero_pieza.trim()}" no tiene color asignado.` }
    }
    if (origen === 'manual' && r.estado === 'en_stock' && !r.ubicacion.trim()) {
      return {
        error:
          'Los rollos en estado "en stock" deben tener ubicación asignada.',
      }
    }
  }

  const numeros = input.rollos.map((r) => r.numero_pieza.trim())
  const unicos = new Set(numeros)
  if (unicos.size !== numeros.length) {
    return { error: 'Hay números de pieza duplicados en el ingreso.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sesión expirada — volvé a iniciar sesión.' }

  // Estado del ingreso derivado del origen:
  // - planilla_ia → siempre `auditado` (rollos quedan `pendiente`, esperan scanner físico en Etapa 4)
  // - manual: si todos los rollos están en_stock → `confirmado`, si alguno está pendiente → `borrador`
  let ingresoEstado: 'borrador' | 'auditado' | 'confirmado'
  if (origen === 'planilla_ia') {
    ingresoEstado = 'auditado'
  } else {
    const algunoPendiente = input.rollos.some((r) => r.estado === 'pendiente')
    ingresoEstado = algunoPendiente ? 'borrador' : 'confirmado'
  }

  // Nota: las columnas `ingresos.color` e `ingresos.articulo_id` quedaron
  // deprecated en migración 036. El color y el artículo se cargan por rollo.
  const { data: ingreso, error: iError } = await supabase
    .from('ingresos')
    .insert({
      tintoreria_id: input.tintoreria_id,
      fecha_despacho: input.fecha,
      numero_remito: input.numero_remito.trim() || null,
      ot: input.ot?.trim() || null,
      rem_tejeduria: input.rem_tejeduria?.trim() || null,
      referencia: input.referencia?.trim() || null,
      total_rollos_declarado: input.total_rollos_declarado
        ? parseInt(input.total_rollos_declarado)
        : null,
      total_kilos_declarado: input.total_kilos_declarado
        ? parseFloat(input.total_kilos_declarado)
        : null,
      imagen_url: input.imagen_path ?? null,
      estado: ingresoEstado,
      origen,
      created_by: user.id,
    })
    .select()
    .single()

  if (iError || !ingreso) {
    return { error: `No se pudo crear el ingreso: ${iError?.message}` }
  }

  // Resolución (articulo, color) por rollo. Cada rollo trae un
  // articulo_id (apunta a una fila específica del catálogo, con su
  // propio color) y un color elegido por el usuario. Si el color del
  // rollo difiere del color del articulo apuntado, hay que reapuntar
  // a la fila (mismo_nombre, nuevo_color) — la creamos si no existe.
  // El catálogo articulos se mantiene como N filas, una por
  // combinación (nombre, color).
  const articulosIdsUnicos = Array.from(
    new Set(input.rollos.map((r) => r.articulo_id).filter((id): id is string => !!id))
  )
  const { data: articulosBase, error: aError } = await supabase
    .from('articulos')
    .select('id, nombre, color')
    .in('id', articulosIdsUnicos)
  if (aError || !articulosBase) {
    await supabase.from('ingresos').delete().eq('id', ingreso.id)
    return { error: `No se pudieron leer los artículos: ${aError?.message}` }
  }
  const articuloById = new Map(articulosBase.map((a) => [a.id, a]))

  // Para cada rollo, resolver el articulo_id que corresponde a la
  // combinación (nombre del articulo apuntado, color elegido).
  const rollosResueltos: Array<{ rollo: RolloInput; articulo_id: string }> = []
  for (const r of input.rollos) {
    const articulo = articuloById.get(r.articulo_id!)
    if (!articulo) {
      await supabase.from('ingresos').delete().eq('id', ingreso.id)
      return { error: `El artículo del rollo "${r.numero_pieza.trim()}" no existe.` }
    }
    const colorNorm = normalizarTitleCase(r.color!)
    if (articulo.color === colorNorm) {
      rollosResueltos.push({ rollo: r, articulo_id: articulo.id })
      continue
    }
    // Color difiere: buscar fila (mismo nombre, nuevo color) o crear.
    const { data: existente } = await supabase
      .from('articulos')
      .select('id')
      .eq('nombre', articulo.nombre)
      .eq('color', colorNorm)
      .maybeSingle()
    let articuloIdFinal = existente?.id
    if (!articuloIdFinal) {
      const { data: creado, error: cError } = await supabase
        .from('articulos')
        .insert({ nombre: articulo.nombre, color: colorNorm })
        .select('id')
        .single()
      if (cError && cError.code === '23505') {
        // Race: otro request creó la fila entre el select y el insert.
        const { data: retry } = await supabase
          .from('articulos')
          .select('id')
          .eq('nombre', articulo.nombre)
          .eq('color', colorNorm)
          .maybeSingle()
        articuloIdFinal = retry?.id
      } else if (cError || !creado) {
        await supabase.from('ingresos').delete().eq('id', ingreso.id)
        return {
          error: `No se pudo crear "${articulo.nombre} ${colorNorm}": ${cError?.message ?? 'error desconocido'}`,
        }
      } else {
        articuloIdFinal = creado.id
      }
    }
    rollosResueltos.push({ rollo: r, articulo_id: articuloIdFinal! })
  }

  const rollosToInsert = rollosResueltos.map(({ rollo: r, articulo_id }) => ({
    ingreso_id: ingreso.id,
    articulo_id,
    // rollos.color lo sincroniza el trigger sync_rollo_color desde
    // articulos.color, no hace falta setearlo acá.
    numero_pieza: r.numero_pieza.trim(),
    kilos: r.kilos ? parseFloat(r.kilos) : null,
    metros: r.metros ? parseFloat(r.metros) : null,
    ratio_rendimiento: r.ratio_rendimiento
      ? parseFloat(r.ratio_rendimiento)
      : null,
    gramaje_planilla: r.gramaje_planilla
      ? parseFloat(r.gramaje_planilla)
      : null,
    ubicacion: r.ubicacion.trim() || null,
    estado: r.estado,
    confianza_ia: r.confianza_ia ?? null,
  }))

  const { error: rError } = await supabase.from('rollos').insert(rollosToInsert)

  if (rError) {
    await supabase.from('ingresos').delete().eq('id', ingreso.id)
    if (rError.code === '23505') {
      const match = rError.message.match(/\(empresa_id, numero_pieza\)=\([^,]+, ([^)]+)\)/)
      const numero = match?.[1]
      return {
        error: numero
          ? `El número de pieza "${numero}" ya existe en otro rollo de la empresa. Cambialo y volvé a intentar.`
          : 'Hay números de pieza que ya existen en la empresa. Revisá y volvé a intentar.',
      }
    }
    return { error: `No se pudieron cargar los rollos: ${rError.message}` }
  }

  redirect(`/ingresos/${ingreso.id}?creado=1`)
}

// ── Edición de encabezado de ingreso (solo admin) ──────────

export type EditarIngresoInput = {
  ingresoId: string
  tintoreria_id: string
  fecha: string
  numero_remito: string
  ot: string
  rem_tejeduria: string
  referencia: string
  total_rollos_declarado: string
  total_kilos_declarado: string
}

export async function editarIngreso(input: EditarIngresoInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada — volvé a iniciar sesión.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Solo el administrador puede editar ingresos.' }
  }

  const { error } = await supabase
    .from('ingresos')
    .update({
      tintoreria_id: input.tintoreria_id,
      fecha_despacho: input.fecha,
      numero_remito: input.numero_remito.trim() || null,
      ot: input.ot.trim() || null,
      rem_tejeduria: input.rem_tejeduria.trim() || null,
      referencia: input.referencia.trim() || null,
      total_rollos_declarado: input.total_rollos_declarado
        ? parseInt(input.total_rollos_declarado)
        : null,
      total_kilos_declarado: input.total_kilos_declarado
        ? parseFloat(input.total_kilos_declarado)
        : null,
      editado_at: new Date().toISOString(),
      editado_por: user.id,
    })
    .eq('id', input.ingresoId)

  if (error) return { error: error.message }

  redirect(`/ingresos/${input.ingresoId}?editado=1`)
}

export async function createArticuloInline(nombre: string, color: string) {
  const supabase = await createClient()
  const cleanNombre = nombre.trim()
  const cleanColor = normalizarTitleCase(color)

  if (!cleanNombre) return { error: 'El nombre no puede estar vacío.' }
  if (!cleanColor) return { error: 'El color es obligatorio.' }

  const { data: existente } = await supabase
    .from('articulos')
    .select('id, nombre, color')
    .eq('nombre', cleanNombre)
    .eq('color', cleanColor)
    .maybeSingle()

  if (existente) return { success: true, data: existente }

  const { data, error } = await supabase
    .from('articulos')
    .insert({ nombre: cleanNombre, color: cleanColor })
    .select('id, nombre, color')
    .single()

  if (error || !data) {
    // Race: otro request creó la fila entre el lookup y el insert.
    if (error?.code === '23505') {
      const { data: retry } = await supabase
        .from('articulos')
        .select('id, nombre, color')
        .eq('nombre', cleanNombre)
        .eq('color', cleanColor)
        .maybeSingle()
      if (retry) return { success: true, data: retry }
    }
    return { error: error?.message ?? 'Error al crear.' }
  }
  return { success: true, data }
}

export async function createColorInline(nombre: string) {
  const supabase = await createClient()
  const normalizado = normalizarTitleCase(nombre)
  if (!normalizado) return { error: 'El nombre no puede estar vacío.' }

  const { data: existente } = await supabase
    .from('colores')
    .select('id, nombre')
    .eq('nombre', normalizado)
    .maybeSingle()

  if (existente) return { success: true, data: existente }

  const { data, error } = await supabase
    .from('colores')
    .insert({ nombre: normalizado })
    .select('id, nombre')
    .single()

  if (error || !data) return { error: error?.message ?? 'Error al crear.' }
  return { success: true, data }
}
