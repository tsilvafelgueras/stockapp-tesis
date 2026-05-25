import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import TintoreriaForm from './TintoreriaForm'
import TintoreriaRow from './TintoreriaRow'

type Tintoreria = {
  id: string
  nombre: string
  activo: boolean
  created_at: string
  fecha_baja: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
}

export default async function TintoreriasPage() {
  const supabase = await createClient()

  const { data: tintorerias } = await supabase
    .from('tintorerias')
    .select(
      'id, nombre, activo, created_at, fecha_baja, contacto, email, telefono'
    )
    .order('activo', { ascending: false })
    .order('nombre', { ascending: true })

  const lista = (tintorerias ?? []) as Tintoreria[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-2xl font-bold mt-1">Tintorerías</h1>
        <p className="text-sm text-muted-foreground">
          Proveedores que tiñen las telas. Dales de alta y de baja según la
          relación comercial activa.
        </p>
      </div>

      <TintoreriaForm />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nombre y contacto</th>
                <th className="px-4 py-3 font-medium w-28">Alta</th>
                <th className="px-4 py-3 font-medium w-36">Estado</th>
                <th className="px-4 py-3 font-medium w-72"></th>
              </tr>
            </thead>
            <tbody>
              {lista.length > 0 ? (
                lista.map((t) => (
                  <TintoreriaRow
                    key={t.id}
                    id={t.id}
                    nombre={t.nombre}
                    activo={t.activo}
                    createdAt={t.created_at}
                    fechaBaja={t.fecha_baja}
                    contacto={t.contacto}
                    email={t.email}
                    telefono={t.telefono}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavía no cargaste ninguna tintorería.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
