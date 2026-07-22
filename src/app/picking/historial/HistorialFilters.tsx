'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function HistorialFilters() {
  const router = useRouter()
  const sp = useSearchParams()
  const [cliente, setCliente] = useState(sp.get('cliente') ?? '')
  const [desde, setDesde] = useState(sp.get('desde') ?? '')
  const [hasta, setHasta] = useState(sp.get('hasta') ?? '')
  const [isPending, startTransition] = useTransition()

  function aplicar() {
    const params = new URLSearchParams()
    if (cliente.trim()) params.set('cliente', cliente.trim())
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    startTransition(() => {
      router.push(
        `/picking/historial${params.toString() ? '?' + params.toString() : ''}`
      )
    })
  }

  function limpiar() {
    setCliente('')
    setDesde('')
    setHasta('')
    startTransition(() => router.push('/picking/historial'))
  }

  const tieneFiltros = cliente.trim() || desde || hasta

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Cliente
        </label>
        <input
          type="text"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aplicar()}
          placeholder="Buscar por cliente..."
          className="w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Desde
        </label>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Hasta
        </label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={aplicar}
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Buscando...' : 'Buscar'}
      </button>
      {tieneFiltros && (
        <button
          type="button"
          onClick={limpiar}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
