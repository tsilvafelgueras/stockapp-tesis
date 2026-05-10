import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function VentasDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Volver al panel
          </Link>
        )}
        <h1 className="text-2xl font-bold mt-1">Pedidos</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenida, {profile?.nombre ?? 'usuaria'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/stock"
          className="rounded-lg border bg-white p-5 shadow-sm hover:bg-zinc-50 transition-colors"
        >
          <h2 className="font-semibold mb-1">Stock disponible</h2>
          <p className="text-sm text-muted-foreground">
            Buscar rollos por artículo y color
          </p>
        </Link>
        <Link
          href="/ventas/pedidos/nuevo"
          className="rounded-lg border bg-white p-5 shadow-sm hover:bg-zinc-50 transition-colors"
        >
          <h2 className="font-semibold mb-1">Nuevo pedido</h2>
          <p className="text-sm text-muted-foreground">
            Reservar rollos para un cliente
          </p>
        </Link>
        <Link
          href="/ventas/pedidos"
          className="rounded-lg border bg-white p-5 shadow-sm hover:bg-zinc-50 transition-colors sm:col-span-2"
        >
          <h2 className="font-semibold mb-1">Pedidos abiertos</h2>
          <p className="text-sm text-muted-foreground">
            Estado de pedidos pendientes, en preparación y listos
          </p>
        </Link>
      </div>
    </div>
  )
}
