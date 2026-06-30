'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  ETIQUETA_LIMITES,
  normalizeEtiquetaConfig,
  type EtiquetaConfig,
} from '../etiqueta-config'

type ActionResult = { ok: true } | { ok: false; error: string }

function dentroDeRango(c: EtiquetaConfig): string | null {
  for (const k of Object.keys(ETIQUETA_LIMITES) as (keyof typeof ETIQUETA_LIMITES)[]) {
    const { min, max } = ETIQUETA_LIMITES[k]
    const v = c[k]
    if (v < min || v > max) {
      return `El valor de "${k}" debe estar entre ${min} y ${max}.`
    }
  }
  return null
}

// Upsert de la config de etiqueta de la empresa del usuario actual.
// Lo pueden hacer operario o admin (mismo acceso que el etiquetado manual).
export async function guardarEtiquetaConfig(
  input: EtiquetaConfig
): Promise<ActionResult> {
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

  const config = normalizeEtiquetaConfig(input)
  const fueraDeRango = dentroDeRango(config)
  if (fueraDeRango) return { ok: false, error: fueraDeRango }

  const { error } = await supabase.from('empresa_etiqueta_config').upsert(
    {
      empresa_id: profile.empresa_id,
      ...config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_id' }
  )

  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` }

  revalidatePath('/rollos-sin-etiqueta/ajustes')
  revalidatePath('/rollos-sin-etiqueta/etiqueta')
  return { ok: true }
}
