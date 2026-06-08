import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import RollosSinEtiquetaForm from './RollosSinEtiquetaForm'

type ArticuloRow = {
  id: string
  nombre: string
  articulo_colores: Array<{
    colores: { id: string; nombre: string } | { id: string; nombre: string }[] | null
  }> | null
}

export default async function NuevosRollosSinEtiquetaPage() {
  const supabase = await createClient()

  const [
    { data: ingresosRaw },
    { data: empresaTints },
    { data: articulosRaw },
  ] = await Promise.all([
    supabase
      .from('ingresos')
      .select('id, numero_lote, fecha_despacho, tintorerias(nombre)')
      .order('fecha_despacho', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('empresa_tintorerias')
      .select('tintoreria_id, tintorerias(id, nombre)')
      .eq('activo', true),
    supabase
      .from('articulos')
      .select('id, nombre, articulo_colores(colores(id, nombre))')
      .eq('activo', true)
      .order('nombre'),
  ])

  type IngresoRow = {
    id: string
    numero_lote: string | null
    fecha_despacho: string | null
    tintorerias: { nombre: string } | null
  }
  const ingresos = (ingresosRaw ?? []).map((r) => {
    const row = r as unknown as IngresoRow
    return {
      id: row.id,
      numero_lote: row.numero_lote ?? '',
      fecha_despacho: row.fecha_despacho ?? '',
      tintoria_nombre: (row.tintorerias as unknown as { nombre: string } | null)?.nombre ?? '',
    }
  })

  type EmpresaTintRow = {
    tintoreria_id: string
    tintorerias: { id: string; nombre: string } | null
  }
  const tintorerias = (empresaTints ?? ([] as unknown as EmpresaTintRow[]))
    .map((r) => (r as unknown as EmpresaTintRow).tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const articulos = (articulosRaw ?? []).map((a: ArticuloRow) => {
    const cols = (a.articulo_colores ?? [])
      .map((ac) => (Array.isArray(ac.colores) ? ac.colores[0] : ac.colores))
      .filter((c): c is { id: string; nombre: string } => !!c)
    return { id: a.id, nombre: a.nombre, colores: cols }
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <BackButton href="/ingresos" label="Volver a ingresos" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Rollos sin etiqueta</h1>
        <p className="text-sm text-muted-foreground">
          Registrá rollos que llegaron sin etiqueta y generá sus etiquetas con QR
        </p>
      </div>

      <RollosSinEtiquetaForm
        ingresos={ingresos}
        tintorerias={tintorerias}
        articulos={articulos}
      />
    </div>
  )
}
