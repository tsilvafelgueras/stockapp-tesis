import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import ClientesList, { type ClienteRow } from './ClientesList'

export default async function ClientesPage() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: pedidos }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre, contacto, email, telefono, direccion, notas, activo, created_at')
      .order('nombre'),
    supabase.from('pedidos').select('cliente_id'),
  ])

  // Contar pedidos por cliente_id en memoria (volumen chico)
  const countByCliente = new Map<string, number>()
  for (const p of pedidos ?? []) {
    if (!p.cliente_id) continue
    countByCliente.set(p.cliente_id, (countByCliente.get(p.cliente_id) ?? 0) + 1)
  }

  const rows: ClienteRow[] = (clientes ?? []).map((c) => ({
    ...c,
    pedidos_count: countByCliente.get(c.id) ?? 0,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <BackButton href="/ventas/dashboard" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de clientes y resumen de actividad.
        </p>
      </div>

      <ClientesList clientes={rows} />
    </div>
  )
}
