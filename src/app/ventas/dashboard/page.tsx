import { createClient } from '@/lib/supabase/server'

export default async function VentasDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Panel de Ventas</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenida, {profile?.nombre ?? 'usuaria'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Stock disponible</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Buscar rollos por artículo y color
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Nuevo pedido</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reservar rollos para un cliente
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Pedidos abiertos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de pedidos pendientes y en preparación
          </p>
        </div>
      </div>
    </div>
  )
}
