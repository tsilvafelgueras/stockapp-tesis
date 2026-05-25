import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import NuevaTintoreriaSuperForm from './NuevaTintoreriaSuperForm'

export default async function SuperTintoreriasPage() {
  const admin = createAdminClient()

  const [{ data: tintorerias }, { data: empresas }] = await Promise.all([
    admin
      .from('tintorerias')
      .select('id, nombre, empresa_id, activo, reader_type, extraction_prompt, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('empresas')
      .select('id, nombre')
      .order('nombre'),
  ])

  const empresaNombre = new Map<string, string>()
  for (const e of empresas ?? []) {
    empresaNombre.set(e.id, e.nombre)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tintorerías (todas las empresas)</h1>
        <p className="text-sm text-muted-foreground">
          Configurá el prompt de extracción con IA y el tipo de lector de
          códigos por tintorería. Sólo el superadmin ve esto.
        </p>
      </div>

      <NuevaTintoreriaSuperForm empresas={empresas ?? []} />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Tintorería</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Lector</th>
              <th className="px-4 py-3 font-medium">Prompt custom</th>
              <th className="px-4 py-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {tintorerias && tintorerias.length > 0 ? (
              tintorerias.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{t.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {empresaNombre.get(t.empresa_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {t.activo ? (
                      <span className="text-xs text-success">Activa</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Dada de baja
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ReaderBadge readerType={t.reader_type as 'qr' | 'barcode' | null} />
                  </td>
                  <td className="px-4 py-3">
                    {t.extraction_prompt ? (
                      <span className="text-xs rounded-full bg-success/10 text-success px-2 py-0.5">
                        Sí
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super/tintorerias/${t.id}`}
                      className="text-sm text-action hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin tintorerías todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        El admin de cada empresa puede crear sus propias tintorerías desde su
        sección de administración, pero <strong>no ve</strong> los campos de
        prompt ni de tipo de lector — esos los configuramos sólo desde acá.
      </p>
    </div>
  )
}

function ReaderBadge({ readerType }: { readerType: 'qr' | 'barcode' | null }) {
  if (readerType === 'qr') {
    return (
      <span className="text-xs rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5">
        QR
      </span>
    )
  }
  if (readerType === 'barcode') {
    return (
      <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
        Barcode
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Genérico</span>
  )
}
