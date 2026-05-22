import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import { NuevoArticuloForm } from './ArticuloForm'
import ArticulosTabla from './ArticulosTabla'

export default async function ArticulosPage() {
  const supabase = await createClient()

  const { data: articulos } = await supabase
    .from('articulos')
    .select('id, nombre, descripcion, stock_minimo_kg')
    .eq('activo', true)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <DashboardBackButton />
          <h1 className="text-2xl font-bold mt-1">Artículos</h1>
          <p className="text-sm text-muted-foreground">
            Tipos de tela disponibles
          </p>
        </div>
      </div>

      <NuevoArticuloForm />

      <ArticulosTabla articulos={articulos ?? []} />
    </div>
  )
}
