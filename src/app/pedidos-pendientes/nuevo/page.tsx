import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import NuevaDemandaForm from './NuevaDemandaForm'

export default async function NuevaDemandaPage() {
  const supabase = await createClient()

  const { data: articulos } = await supabase
    .from('articulos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <BackButton href="/pedidos-pendientes" label="Volver a demandas" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nueva demanda</h1>
        <p className="text-sm text-muted-foreground">
          Registrá el pedido de un cliente que aún no tiene stock disponible
        </p>
      </div>

      <NuevaDemandaForm articulos={articulos ?? []} />
    </div>
  )
}
