'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function normalizar(nombre: string): string {
  const limpio = nombre.trim().toLowerCase()
  return limpio.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

export async function createColor(formData: { nombre: string }) {
  const supabase = await createClient()

  const nombre = normalizar(formData.nombre)
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('colores').insert({ nombre })

  if (error) {
    if (error.code === '23505') {
      return { error: `El color "${nombre}" ya existe.` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true }
}

export async function toggleColorActivo(id: string, activo: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('colores')
    .update({ activo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/colores')
  return { success: true }
}
