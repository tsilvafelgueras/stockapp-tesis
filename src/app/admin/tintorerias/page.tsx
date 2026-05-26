import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import TintoreriaForm from './TintoreriaForm'
import TintoreriaRow from './TintoreriaRow'

type Tintoreria = {
  tintoreria_id: string
  nombre: string
  activo: boolean
  created_at: string
  fecha_baja: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
}

type EmpresaTintoreriaRow = {
  tintoreria_id: string
  activo: boolean
  created_at: string
  fecha_baja: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
  tintorerias: { id: string; nombre: string } | null
}

export default async function TintoreriasPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('empresa_tintorerias')
    .select(
      `
      tintoreria_id,
      activo,
      created_at,
      fecha_baja,
      contacto,
      email,
      telefono,
      tintorerias ( id, nombre )
    `
    )
    .order('activo', { ascending: false })

  const data = (rows ?? []) as unknown as EmpresaTintoreriaRow[]
  const lista: Tintoreria[] = data
    .filter((r) => r.tintorerias != null)
    .map((r) => ({
      tintoreria_id: r.tintoreria_id,
      nombre: r.tintorerias!.nombre,
      activo: r.activo,
      created_at: r.created_at,
      fecha_baja: r.fecha_baja,
      contacto: r.contacto,
      email: r.email,
      telefono: r.telefono,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const yaAsociadas = new Set(lista.map((t) => t.tintoreria_id))

  const { data: todasLasTints } = await supabase
    .from('tintorerias')
    .select('id, nombre')
    .order('nombre')

  const tintoreriasDisponibles = (todasLasTints ?? []).filter(
    (t) => !yaAsociadas.has(t.id)
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-2xl font-bold mt-1">Tintorerías</h1>
        <p className="text-sm text-muted-foreground">
          Proveedores que tiñen las telas. Asociá las que trabajan con tu
          empresa, cargá los datos de contacto y dales de baja cuando termine
          la relación. Si la tintorería que buscás no aparece, pedíle al
          superadmin que la cree primero.
        </p>
      </div>

      <TintoreriaForm tintoreriasDisponibles={tintoreriasDisponibles} />

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
                    key={t.tintoreria_id}
                    tintoreriaId={t.tintoreria_id}
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
                    Todavía no asociaste ninguna tintorería a tu empresa.
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
