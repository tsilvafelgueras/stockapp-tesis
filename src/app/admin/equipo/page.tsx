import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import InviteForm from './InviteForm'
import UsuarioRow from './UsuarioRow'

export default async function EquipoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: usuarios } = await supabase
    .from('profiles')
    .select('id, nombre, role, created_at')
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <BackButton href="/admin/dashboard" />
        <h1 className="text-2xl font-bold mt-1">Equipo</h1>
        <p className="text-sm text-muted-foreground">
          Usuarios que pueden acceder a tu empresa
        </p>
      </div>

      <InviteForm />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3 font-medium w-44"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios && usuarios.length > 0 ? (
              usuarios.map((u) => (
                <UsuarioRow
                  key={u.id}
                  usuario={u}
                  esYo={u.id === user?.id}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin usuarios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
