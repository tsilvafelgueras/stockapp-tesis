import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role key.
 *
 * ⚠ IMPORTANTE: este cliente bypasses Row-Level Security (RLS).
 * Solo usarlo en Server Actions / Route Handlers para operaciones
 * de super-admin (crear empresa, invitar usuario por email, etc.).
 *
 * NUNCA usarlo desde Client Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
