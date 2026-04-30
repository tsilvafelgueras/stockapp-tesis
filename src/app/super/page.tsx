import { createAdminClient } from '@/lib/supabase/admin'
import NuevaEmpresaForm from './NuevaEmpresaForm'

export default async function SuperPage() {
  // Usamos admin client (bypassa RLS) para listar todas las empresas
  // y el conteo de usuarios por empresa.
  const admin = createAdminClient()

  const { data: empresas } = await admin
    .from('empresas')
    .select('id, nombre, activo, created_at')
    .order('created_at', { ascending: false })

  // Conteo de perfiles por empresa
  const { data: profilesCount } = await admin
    .from('profiles')
    .select('empresa_id')

  const usuariosPorEmpresa = new Map<string, number>()
  for (const p of profilesCount ?? []) {
    if (p.empresa_id) {
      usuariosPorEmpresa.set(
        p.empresa_id,
        (usuariosPorEmpresa.get(p.empresa_id) ?? 0) + 1
      )
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Cada empresa tiene sus datos completamente aislados.
        </p>
      </div>

      <NuevaEmpresaForm />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Usuarios</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Alta</th>
            </tr>
          </thead>
          <tbody>
            {empresas && empresas.length > 0 ? (
              empresas.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{e.nombre}</td>
                  <td className="px-4 py-3">
                    {usuariosPorEmpresa.get(e.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {e.activo ? (
                      <span className="text-xs text-success">Activa</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin empresas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
