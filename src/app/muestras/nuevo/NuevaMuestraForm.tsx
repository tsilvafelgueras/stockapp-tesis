'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { registrarMuestra } from '../actions'

export type RolloOpcion = {
  id: string
  numero_pieza: string
  kilos: number | null
  estado: string
  articulo: string | null
  color: string | null
}

export default function NuevaMuestraForm({
  rollos,
}: {
  rollos: RolloOpcion[]
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [rolloId, setRolloId] = useState('')
  const [kilos, setKilos] = useState('')
  const [cliente, setCliente] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const rolloElegido = useMemo(
    () => rollos.find((r) => r.id === rolloId) ?? null,
    [rolloId, rollos]
  )

  const rollosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return rollos.slice(0, 50)
    return rollos
      .filter(
        (r) =>
          r.numero_pieza.toLowerCase().includes(q) ||
          (r.articulo ?? '').toLowerCase().includes(q) ||
          (r.color ?? '').toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [busqueda, rollos])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!rolloElegido) {
      setError('Tenés que elegir un rollo.')
      return
    }
    const kilosNum = Number(kilos.replace(',', '.'))
    if (!Number.isFinite(kilosNum) || kilosNum <= 0) {
      setError('Los kilos deben ser un número mayor a cero.')
      return
    }
    if (
      rolloElegido.kilos != null &&
      kilosNum > Number(rolloElegido.kilos)
    ) {
      setError(
        `El rollo solo tiene ${Number(rolloElegido.kilos).toFixed(2)} kg disponibles.`
      )
      return
    }
    if (!cliente.trim()) {
      setError('El cliente es obligatorio.')
      return
    }

    startTransition(async () => {
      const res = await registrarMuestra({
        rolloId: rolloElegido.id,
        kilos: kilosNum,
        cliente,
        motivo,
        pedidoId: null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Muestra de ${kilosNum.toFixed(2)} kg registrada para ${cliente.trim()}.`
      )
      router.push('/muestras')
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {/* Selector de rollo */}
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">1. Elegí el rollo</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Buscar por pieza, artículo o color
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. 12345 o Negro"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
          {rollosFiltrados.length > 0 ? (
            rollosFiltrados.map((r) => {
              const sel = r.id === rolloId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRolloId(r.id)}
                  className={`flex items-center justify-between gap-3 w-full px-3 py-2 text-left text-sm transition-colors ${
                    sel
                      ? 'bg-primary/10'
                      : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      Pieza {r.numero_pieza}
                      {sel && (
                        <span className="ml-2 text-xs text-primary">
                          ✓ elegido
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.articulo ?? '—'}
                      {r.color ? ` · ${r.color}` : ''}
                      {r.estado === 'reservado' ? ' · reservado' : ''}
                    </p>
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                    {r.kilos != null
                      ? `${Number(r.kilos).toFixed(2)} kg`
                      : '—'}
                  </span>
                </button>
              )
            })
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No se encontraron rollos.
            </p>
          )}
        </div>

        {rollos.length > 50 && !busqueda && (
          <p className="text-xs text-muted-foreground">
            Mostrando los primeros 50. Filtrá para encontrar uno específico.
          </p>
        )}
      </section>

      {/* Datos de la muestra */}
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">2. Datos de la muestra</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Kilos a descontar <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={kilos}
              onChange={(e) => setKilos(e.target.value)}
              placeholder="Ej. 0,5"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
            {rolloElegido?.kilos != null && (
              <p className="text-xs text-muted-foreground">
                Disponibles en este rollo:{' '}
                {Number(rolloElegido.kilos).toFixed(2)} kg
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Cliente <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Motivo (opcional)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Muestra para aprobación de color"
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !rolloId || !kilos.trim() || !cliente.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Registrando…' : 'Registrar muestra'}
        </button>
      </div>
    </form>
  )
}
