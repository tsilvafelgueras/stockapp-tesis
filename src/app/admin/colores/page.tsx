import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import ColorForm from './ColorForm'
import ColorRow from './ColorRow'

export default async function ColoresPage() {
  const supabase = await createClient()

  const { data: colores } = await supabase
    .from('colores')
    .select('*')
    .order('nombre', { ascending: true })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-2xl font-bold mt-1">Colores</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de colores disponibles para los ingresos
        </p>
      </div>

      <ColorForm />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody>
            {colores && colores.length > 0 ? (
              colores.map((c) => (
                <ColorRow
                  key={c.id}
                  id={c.id}
                  nombre={c.nombre}
                  activo={c.activo}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no cargaste ningún color.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
