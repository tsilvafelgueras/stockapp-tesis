import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import { NuevoArticuloForm } from './ArticuloForm'
import ArticulosTabla from './ArticulosTabla'

type Role = 'admin' | 'ventas' | 'operario' | 'super'

type ArticuloColorRow = {
  stock_minimo_kg: number | null
  colores: { id: string; nombre: string } | { id: string; nombre: string }[] | null
}

type ArticuloRow = {
  id: string
  nombre: string
  descripcion: string | null
  stock_minimo_kg: number | null
  articulo_colores: ArticuloColorRow[] | null
}

export default async function ArticulosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: articulosRaw }, { data: colores }] = await Promise.all([
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('articulos')
      .select(
        `id, nombre, descripcion, stock_minimo_kg,
         articulo_colores(stock_minimo_kg, colores(id, nombre))`
      )
      .eq('activo', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('colores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ])

  const role = (profile?.role ?? 'operario') as Role

  // Flatten: cada artículo trae `articulo_colores: [{ colores: {...} }]`
  // Supabase puede devolver `colores` como objeto o array dependiendo de
  // la cardinalidad detectada; lo aplastamos a `{ id, nombre }[]`.
  const articulos = (articulosRaw ?? []).map((a: ArticuloRow) => {
    const cols = (a.articulo_colores ?? [])
      .map((ac) => {
        const color = Array.isArray(ac.colores) ? ac.colores[0] : ac.colores
        return color
          ? { ...color, stock_minimo_kg: ac.stock_minimo_kg }
          : null
      })
      .filter(
        (c): c is { id: string; nombre: string; stock_minimo_kg: number | null } =>
          !!c
      )
    return {
      id: a.id,
      nombre: a.nombre,
      descripcion: a.descripcion,
      stock_minimo_kg: null,
      colores: cols,
    }
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <DashboardBackButton />
          <h1 className="text-2xl font-bold mt-1">Artículos</h1>
          <p className="text-sm text-muted-foreground">
            Tipos de tela disponibles
          </p>
        </div>
      </div>

      <NuevoArticuloForm colores={colores ?? []} role={role} />

      <ArticulosTabla
        articulos={articulos}
        colores={colores ?? []}
        role={role}
      />
    </div>
  )
}
