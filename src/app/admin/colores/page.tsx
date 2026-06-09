import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import ColorForm from './ColorForm'
import ColorRow from './ColorRow'
import SolicitudesColorPanel from './SolicitudesColorPanel'

export default async function ColoresPage() {
  const supabase = await createClient()

  const [{ data: colores }, { data: solicitudesRaw }] = await Promise.all([
    supabase
      .from('colores')
      .select('*')
      .order('nombre', { ascending: true }),
    supabase
      .from('solicitudes_color')
      .select('id, nombre_solicitado, motivo, created_at, solicitado_por')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false }),
  ])

  // Resolvemos el nombre del solicitante en una segunda query: NO hay FK directa
  // de solicitudes_color.solicitado_por → profiles (apunta a auth.users), así que
  // el embed de PostgREST (profiles:solicitado_por) no funciona y dejaba el panel
  // vacío.
  const solicitanteIds = [
    ...new Set((solicitudesRaw ?? []).map((s) => s.solicitado_por)),
  ]
  const nombrePorId = new Map<string, string>()
  if (solicitanteIds.length) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('id', solicitanteIds)
    for (const p of perfiles ?? []) nombrePorId.set(p.id, p.nombre as string)
  }

  const solicitudes = (solicitudesRaw ?? []).map((s) => ({
    id: s.id,
    nombre_solicitado: s.nombre_solicitado,
    motivo: s.motivo,
    created_at: s.created_at,
    solicitante: nombrePorId.get(s.solicitado_por) ?? null,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-2xl font-bold mt-1">Colores</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de colores disponibles. Solo el admin puede crear o editar;
          operarios y ventas envían solicitudes que aprobás acá.
        </p>
      </div>

      <SolicitudesColorPanel solicitudes={solicitudes} />

      <ColorForm colores={colores ?? []} />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium w-40"></th>
            </tr>
          </thead>
          <tbody>
            {colores && colores.length > 0 ? (
              colores.map((c) => (
                <ColorRow key={c.id} id={c.id} nombre={c.nombre} />
              ))
            ) : (
              <tr>
                <td
                  colSpan={2}
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
