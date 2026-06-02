'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { setKilosCrudo } from './actions'

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Tarjeta para cargar los kilos de crudo enviados a teñir de la partida y ver
 * la merma del proceso (crudo → teñido recibido). El "teñido recibido" es la
 * suma de kilos de los rollos del ingreso, que ya se calcula en el server.
 */
export default function MermaPartidaCard({
  ingresoId,
  kilosCrudoInicial,
  kilosTenidoRecibido,
  puedeEditar,
}: {
  ingresoId: string
  kilosCrudoInicial: number | null
  kilosTenidoRecibido: number
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState(kilosCrudoInicial == null)
  const [valor, setValor] = useState(
    kilosCrudoInicial != null ? String(kilosCrudoInicial) : ''
  )

  const crudo = kilosCrudoInicial

  function guardar() {
    const num = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
    if (num != null && (!Number.isFinite(num) || num < 0)) {
      toast.error('Ingresá un número de kilos válido.')
      return
    }
    startTransition(async () => {
      const res = await setKilosCrudo(ingresoId, num)
      if (res.ok) {
        toast.success('Kilos de crudo guardados.')
        setEditando(false)
        router.refresh()
      } else {
        toast.error(res.error ?? 'No se pudo guardar.')
      }
    })
  }

  // Cálculo de merma (solo cuando hay crudo cargado).
  // merma > 0 = se perdió peso; merma < 0 = ganó peso (tinta/humedad).
  const merma = crudo != null ? crudo - kilosTenidoRecibido : 0
  const mermaPct = crudo != null && crudo > 0 ? (merma / crudo) * 100 : null
  const mermaTexto =
    merma >= 0 ? `${fmt(merma)} kg` : `+${fmt(-merma)} kg`

  return (
    <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-action">
            <Scale className="size-4" />
          </span>
          <h2 className="font-semibold text-sm">Merma de la partida (crudo → teñido)</h2>
        </div>
        {!editando && puedeEditar && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted/50 transition-colors"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Cargá el total de kilos de <strong>crudo</strong> que salieron a teñir
            para esta partida. Es un total del lote, no por rollo.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Kilos de crudo enviados
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={!puedeEditar || pending}
                placeholder="Ej: 120.5"
                className="w-44 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={guardar}
                disabled={!puedeEditar || pending}
                className="shrink-0 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-colors hover:bg-action/90 disabled:opacity-50"
              >
                {pending ? 'Guardando...' : 'Guardar'}
              </button>
              {kilosCrudoInicial != null && (
                <button
                  type="button"
                  onClick={() => {
                    setValor(String(kilosCrudoInicial))
                    setEditando(false)
                  }}
                  disabled={pending}
                  className="shrink-0 rounded-md border px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Crudo enviado" value={`${fmt(crudo ?? 0)} kg`} />
          <Metric
            label="Teñido recibido"
            value={`${fmt(kilosTenidoRecibido)} kg`}
          />
          <Metric
            label="Merma"
            value={mermaTexto}
            tone={merma > 0 ? 'warning' : 'success'}
            hint={merma > 0 ? 'Se perdió peso' : 'Ganó peso'}
          />
          <Metric
            label="Merma %"
            value={mermaPct != null ? `${fmt(mermaPct)}%` : '—'}
            tone={
              mermaPct == null
                ? 'default'
                : mermaPct > 10
                  ? 'destructive'
                  : mermaPct > 0
                    ? 'warning'
                    : 'success'
            }
          />
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: string
  tone?: 'default' | 'warning' | 'destructive' | 'success'
  hint?: string
}) {
  const toneCls =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'success'
          ? 'text-success'
          : ''
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
