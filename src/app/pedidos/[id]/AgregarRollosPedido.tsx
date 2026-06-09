'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { agregarPartidasAPedido } from '../actions'

export type PartidaParaAgregar = {
  key: string
  ingresoId: string
  numeroLote: string | null
  articuloId: string
  articuloNombre: string
  colorId: string
  colorNombre: string
  tintoreriaNombre: string | null
  rollosDisponibles: number
  kilosDisponibles: number
}

export default function AgregarRollosPedido({
  pedidoId,
  estado,
  partidas,
}: {
  pedidoId: string
  estado: string
  partidas: PartidaParaAgregar[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [pending, startTransition] = useTransition()

  const partidasByKey = useMemo(
    () => new Map(partidas.map((p) => [p.key, p])),
    [partidas]
  )
  const seleccionadas = Object.entries(cantidades)
    .map(([key, cantidad]) => ({ partida: partidasByKey.get(key), cantidad }))
    .filter(
      (row): row is { partida: PartidaParaAgregar; cantidad: number } =>
        !!row.partida && row.cantidad > 0
    )
  const totalRollos = seleccionadas.reduce((acc, row) => acc + row.cantidad, 0)

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return partidas.slice(0, 25)
    return partidas
      .filter(
        (p) =>
          (p.numeroLote ?? '').toLowerCase().includes(needle) ||
          p.articuloNombre.toLowerCase().includes(needle) ||
          p.colorNombre.toLowerCase().includes(needle) ||
          (p.tintoreriaNombre ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 40)
  }, [partidas, q])

  function setCantidad(partida: PartidaParaAgregar, value: number) {
    const next = Math.max(
      0,
      Math.min(partida.rollosDisponibles, Math.trunc(value || 0))
    )
    setCantidades((prev) => {
      const clone = { ...prev }
      if (next <= 0) delete clone[partida.key]
      else clone[partida.key] = next
      return clone
    })
  }

  function submit() {
    startTransition(async () => {
      const res = await agregarPartidasAPedido(
        pedidoId,
        seleccionadas.map(({ partida, cantidad }) => ({
          ingresoId: partida.ingresoId,
          articuloId: partida.articuloId,
          colorId: partida.colorId,
          cantidad,
        }))
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Se agregaron ${totalRollos} rollos al pedido.`)
      setCantidades({})
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Agregar rollos al pedido</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ventas suma cantidades por partida. Depósito pickea las piezas reales.
          </p>
          {estado === 'lista' && (
            <p className="mt-1 text-xs text-warning">
              Si agregás rollos a un pedido listo, vuelve a preparación para que
              depósito complete el picking.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          {open ? 'Cerrar' : 'Agregar rollos'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar partida, artículo, color o tintorería"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          {partidas.length === 0 ? (
            <div className="rounded-md border bg-zinc-50 p-4 text-center text-sm text-muted-foreground">
              No hay partidas con rollos libres para agregar.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-zinc-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Partida</th>
                    <th className="px-3 py-2 font-medium">Artículo</th>
                    <th className="px-3 py-2 font-medium">Color</th>
                    <th className="px-3 py-2 font-medium">Tintorería</th>
                    <th className="px-3 py-2 text-right font-medium">Libre</th>
                    <th className="px-3 py-2 font-medium">Agregar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        {p.numeroLote ?? '-'}
                      </td>
                      <td className="px-3 py-2">{p.articuloNombre}</td>
                      <td className="px-3 py-2">{p.colorNombre}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.tintoreriaNombre ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.rollosDisponibles}
                      </td>
                      <td className="px-3 py-2">
                        <CantidadInput
                          partida={p}
                          cantidad={cantidades[p.key] ?? 0}
                          onCantidad={setCantidad}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Seleccionados:{' '}
              <strong className="text-foreground">{totalRollos} rollos</strong>
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={pending || totalRollos === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? 'Agregando...' : 'Agregar al pedido'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function CantidadInput({
  partida,
  cantidad,
  onCantidad,
}: {
  partida: PartidaParaAgregar
  cantidad: number
  onCantidad: (partida: PartidaParaAgregar, value: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onCantidad(partida, cantidad - 1)}
        disabled={cantidad <= 0}
        className="size-8 rounded-md border bg-white text-sm disabled:opacity-40"
      >
        -
      </button>
      <input
        type="number"
        min="0"
        max={partida.rollosDisponibles}
        value={cantidad || ''}
        onChange={(e) => onCantidad(partida, Number(e.target.value))}
        placeholder="0"
        className="h-8 w-16 rounded-md border px-2 text-center text-sm tabular-nums"
      />
      <button
        type="button"
        onClick={() => onCantidad(partida, cantidad + 1)}
        disabled={cantidad >= partida.rollosDisponibles}
        className="size-8 rounded-md border bg-white text-sm disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
