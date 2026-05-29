import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import NuevaMuestraForm, {
  type RolloOpcion,
} from './NuevaMuestraForm'

export default async function NuevaMuestraPage() {
  const supabase = await createClient()

  const [{ data: rollosRaw }, { data: coloresRaw }] = await Promise.all([
    supabase
      .from('rollos')
      .select(
        `
          id,
          numero_pieza,
          kilos,
          estado,
          color_id,
          articulos ( nombre )
        `
      )
      .in('estado', ['en_stock', 'reservado'])
      .order('numero_pieza', { ascending: true })
      .limit(1000),
    supabase.from('colores').select('id, nombre'),
  ])

  const colorById = new Map(
    ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ])
  )

  type Raw = {
    id: string
    numero_pieza: string
    kilos: number | null
    estado: string
    color_id: string | null
    articulos: { nombre: string } | null
  }
  const rollos = ((rollosRaw ?? []) as unknown as Raw[]).map(
    (r): RolloOpcion => ({
      id: r.id,
      numero_pieza: r.numero_pieza,
      kilos: r.kilos,
      estado: r.estado,
      articulo: r.articulos?.nombre ?? null,
      color: r.color_id ? colorById.get(r.color_id) ?? null : null,
    })
  )

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href="/muestras" label="Volver a muestras" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nueva muestra</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una entrega chica que se descuenta del rollo
        </p>
      </div>

      <NuevaMuestraForm rollos={rollos} />
    </div>
  )
}
