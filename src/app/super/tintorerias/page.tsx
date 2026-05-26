import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import NuevaTintoreriaSuperForm from './NuevaTintoreriaSuperForm'

export default async function SuperTintoreriasPage() {
  const admin = createAdminClient()

  const [{ data: tintorerias }, { data: empresaTintorerias }] = await Promise.all([
    admin
      .from('tintorerias')
      .select('id, nombre, reader_type, extraction_prompt, created_at')
      .order('nombre'),
    admin
      .from('empresa_tintorerias')
      .select('tintoreria_id, empresa_id, activo'),
  ])

  const linksPorTintoreria = new Map<
    string,
    { total: number; activas: number }
  >()
  for (const r of empresaTintorerias ?? []) {
    const prev = linksPorTintoreria.get(r.tintoreria_id) ?? {
      total: 0,
      activas: 0,
    }
    prev.total += 1
    if (r.activo) prev.activas += 1
    linksPorTintoreria.set(r.tintoreria_id, prev)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tintorerías (registro global)</h1>
        <p className="text-sm text-muted-foreground">
          Las tintorerías son globales (una tintorería puede estar asociada a
          muchas empresas). Configurá nombre, prompt de extracción IA y tipo
          de lector. Los datos de contacto los gestiona cada empresa por
          separado.
        </p>
      </div>

      <NuevaTintoreriaSuperForm />

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Tintorería</th>
              <th className="px-4 py-3 font-medium">Lector</th>
              <th className="px-4 py-3 font-medium">Prompt custom</th>
              <th className="px-4 py-3 font-medium">Empresas</th>
              <th className="px-4 py-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {tintorerias && tintorerias.length > 0 ? (
              tintorerias.map((t) => {
                const links = linksPorTintoreria.get(t.id)
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{t.nombre}</td>
                    <td className="px-4 py-3">
                      <ReaderBadge
                        readerType={t.reader_type as 'qr' | 'barcode' | null}
                      />
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {links
                        ? `${links.activas} activa${links.activas === 1 ? '' : 's'} · ${links.total} total`
                        : 'Sin asociaciones'}
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
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
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
        Una tintorería puede estar asociada a muchas empresas. Asocialas desde
        el detalle de cada tintorería. El admin de empresa también puede
        elegir tintorerías existentes desde su sección de administración.
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
  return <span className="text-xs text-muted-foreground">Genérico</span>
}
