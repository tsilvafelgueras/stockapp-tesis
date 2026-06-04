'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UBICACIONES } from '@/lib/ubicaciones'
import { confirmarPartida } from './actions'

export type RolloPartida = {
  id: string
  numero_pieza: string
  articulo: string | null
  color: string | null
}

type Props = {
  ingresoId: string
  rollos: RolloPartida[]
  totalDeclarado: number | null
}

type Override = { ubicacion: string; comentario: string }

export default function ConfirmarPartidaForm({
  ingresoId,
  rollos,
  totalDeclarado,
}: Props) {
  const router = useRouter()
  const filas = rollos.length

  const [paso, setPaso] = useState<'conteo' | 'revision'>('conteo')
  const [conteoStr, setConteoStr] = useState('')
  const [conteo, setConteo] = useState<number | null>(null)
  const [ubicacionGeneral, setUbicacionGeneral] = useState('')
  const [nota, setNota] = useState('')
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [confirmando, setConfirmando] = useState(false)

  // ¿El conteo coincide con lo que falta confirmar? Comparamos contra los
  // rollos PENDIENTES (`filas`), no contra el total declarado: una partida
  // puede haber sido confirmada a medias (ej. con el scanner viejo), así que
  // lo que el operario cuenta ahora es lo que queda pendiente.
  const coincide = useMemo(
    () => conteo !== null && conteo === filas,
    [conteo, filas]
  )

  function setOverride(id: string, campo: keyof Override, valor: string) {
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ubicacion: campo === 'ubicacion' ? valor : prev[id]?.ubicacion ?? '',
        comentario: campo === 'comentario' ? valor : prev[id]?.comentario ?? '',
      },
    }))
  }

  function validarConteo() {
    const n = parseInt(conteoStr, 10)
    if (Number.isNaN(n) || n < 0) {
      toast.error('Ingresá cuántos rollos contaste.')
      return
    }
    setConteo(n)
    setPaso('revision')
  }

  async function handleConfirmar() {
    if (conteo === null) return
    if (!coincide && !nota.trim()) {
      toast.error('Dejá una nota explicando la diferencia para confirmar igual.')
      return
    }

    setConfirmando(true)
    try {
      const result = await confirmarPartida(ingresoId, {
        conteoFisico: conteo,
        ubicacionGeneral: ubicacionGeneral || null,
        nota: coincide ? null : nota,
        overrides: rollos
          .map((r) => {
            const o = overrides[r.id]
            if (!o) return null
            const ubic = o.ubicacion.trim()
            const com = o.comentario.trim()
            if (!ubic && !com) return null
            return { id: r.id, ubicacion: ubic || null, comentario: com || null }
          })
          .filter((o): o is NonNullable<typeof o> => o !== null),
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(
        `Partida confirmada — ${result.confirmados} rollos en stock.`
      )
      router.push('/confirmar')
      router.refresh()
    } catch (e) {
      // Si la server action lanza (en vez de devolver {ok:false}), evitamos
      // que el botón quede clavado en "Confirmando…" y mostramos el error.
      toast.error(
        `No se pudo confirmar la partida: ${
          e instanceof Error ? e.message : 'error inesperado'
        }`
      )
    } finally {
      setConfirmando(false)
    }
  }

  // ── Paso 1: conteo ─────────────────────────────────────────
  if (paso === 'conteo') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold">Contá los rollos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisá físicamente cuántos rollos llegaron en esta partida e
              ingresá el número. Lo vamos a comparar con la planilla.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Cantidad de rollos contados
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={conteoStr}
              onChange={(e) => setConteoStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') validarConteo()
              }}
              placeholder="Ej: 24"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Quedan {filas} {filas === 1 ? 'rollo pendiente' : 'rollos pendientes'} de
              confirmar en esta partida
              {totalDeclarado != null && totalDeclarado !== filas
                ? ` (la planilla declaró ${totalDeclarado} en total; el resto ya fue confirmado).`
                : '.'}
            </p>
          </div>

          <button
            type="button"
            onClick={validarConteo}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Validar conteo
          </button>
        </div>
      </div>
    )
  }

  // ── Paso 2: revisión / confirmación ────────────────────────
  return (
    <div className="space-y-4">
      {coincide ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          ✓ El conteo coincide con lo pendiente ({conteo}{' '}
          {conteo === 1 ? 'rollo' : 'rollos'}). Asigná la ubicación y confirmá.
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div>
            <p className="text-sm font-semibold text-warning">
              El conteo no coincide con lo pendiente
            </p>
            <p className="mt-1 text-sm text-warning/90">
              Contaste <strong>{conteo}</strong>, pero quedan{' '}
              <strong>{filas}</strong>{' '}
              {filas === 1 ? 'rollo pendiente' : 'rollos pendientes'} de confirmar
              {totalDeclarado != null && totalDeclarado !== filas ? (
                <>
                  {' '}
                  (la planilla declaró <strong>{totalDeclarado}</strong> en total)
                </>
              ) : null}
              . Podés verificar de nuevo, o dejar una nota y confirmar igual.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-warning">
              Nota de la diferencia{' '}
              <span className="font-normal">(obligatoria)</span>
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Ej: faltó 1 rollo, se reclama a la tintorería."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-lg border bg-white p-4 shadow-sm">
        <label className="text-sm font-medium">Ubicación de la partida</label>
        <p className="text-xs text-muted-foreground">
          Se asigna a todos los rollos. Podés sobrescribirla por rollo abajo.
        </p>
        <select
          value={ubicacionGeneral}
          onChange={(e) => setUbicacionGeneral(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Sin ubicación</option>
          {UBICACIONES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            Rollos pendientes ({filas})
          </h2>
          <p className="text-xs text-muted-foreground">
            Opcional: ajustá la ubicación o agregá un comentario por rollo.
          </p>
        </div>
        <ul className="divide-y">
          {rollos.map((r) => {
            const o = overrides[r.id]
            return (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium">
                    {r.numero_pieza}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[r.articulo, r.color].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={o?.ubicacion ?? ''}
                    onChange={(e) =>
                      setOverride(r.id, 'ubicacion', e.target.value)
                    }
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">
                      Ubicación de la partida
                      {ubicacionGeneral ? ` (${ubicacionGeneral})` : ''}
                    </option>
                    {UBICACIONES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <input
                    value={o?.comentario ?? ''}
                    onChange={(e) =>
                      setOverride(r.id, 'comentario', e.target.value)
                    }
                    placeholder="Comentario (opcional)"
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setPaso('conteo')}
          disabled={confirmando}
          className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          Volver a contar
        </button>
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={confirmando}
          className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {confirmando
            ? 'Confirmando...'
            : coincide
              ? 'Confirmar partida'
              : 'Confirmar igual con nota'}
        </button>
      </div>
    </div>
  )
}
