import { createClient } from '@/lib/supabase/server'
import { loadEtiquetaConfig } from '../etiqueta-config'
import AjustesForm from './AjustesForm'

export const dynamic = 'force-dynamic'

export default async function AjustesEtiquetaPage() {
  const supabase = await createClient()
  const config = await loadEtiquetaConfig(supabase)

  return <AjustesForm configInicial={config} />
}
