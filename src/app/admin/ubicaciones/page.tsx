import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import UbicacionesManager, {
  type UbicacionAdminRow,
} from './UbicacionesManager'

type UbicacionRaw = {
  id: string
  codigo: string
  descripcion: string | null
  tipo: string
  capacidad_rollos: number | null
  capacidad_kg: number | null
  orden: number
  activa: boolean
}

type RolloUbicacionRaw = {
  ubicacion: string | null
  kilos: number | null
}

export default async function AdminUbicacionesPage() {
  const supabase = await createClient()

  const [{ data: ubicacionesRaw, error }, { data: rollosRaw }] =
    await Promise.all([
      supabase
        .from('ubicaciones')
        .select(
          'id, codigo, descripcion, tipo, capacidad_rollos, capacidad_kg, orden, activa'
        )
        .order('orden', { ascending: true })
        .order('codigo', { ascending: true }),
      supabase
        .from('rollos')
        .select('ubicacion, kilos')
        .in('estado', ['pendiente', 'en_stock', 'reservado', 'segunda']),
    ])

  const ocupacion = new Map<string, { rollos: number; kilos: number }>()
  for (const r of (rollosRaw ?? []) as unknown as RolloUbicacionRaw[]) {
    const key = r.ubicacion?.trim()
    if (!key) continue
    const prev = ocupacion.get(key) ?? { rollos: 0, kilos: 0 }
    prev.rollos += 1
    prev.kilos += Number(r.kilos ?? 0)
    ocupacion.set(key, prev)
  }

  const ubicaciones: UbicacionAdminRow[] = (
    (ubicacionesRaw ?? []) as unknown as UbicacionRaw[]
  ).map((u) => ({
    ...u,
    rollos: ocupacion.get(u.codigo)?.rollos ?? 0,
    kilos: ocupacion.get(u.codigo)?.kilos ?? 0,
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:py-8">
      <div>
        <BackButton href="/admin/dashboard" label="Volver al dashboard" />
        <h1 className="mt-1 text-2xl font-bold">Ubicaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá las ubicaciones activas del depósito. Depósito solo podrá
          elegir desde este catálogo.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          No se pudo cargar ubicaciones. Aplicá la migración 049 para habilitar
          esta sección.
        </div>
      ) : (
        <UbicacionesManager ubicaciones={ubicaciones} />
      )}
    </div>
  )
}
