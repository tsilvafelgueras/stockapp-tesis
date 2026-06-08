'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { type CodeScannerResult } from '@/components/CodeScanner'
import ScannerByReaderType from '@/components/ScannerByReaderType'
import SearchableCombobox from '@/components/SearchableCombobox'
import {
  ubicacionesToOptions,
  type UbicacionOption,
} from '@/lib/ubicaciones'
import { registrarMuestra } from '../actions'

export type RolloOpcion = {
  id: string
  numero_pieza: string
  kilos: number | null
  estado: string
  articuloId: string | null
  colorId: string | null
  ubicacion: string | null
  lote: string | null
  tintoreriaId: string | null
  tintoreria: string | null
  articulo: string | null
  color: string | null
}

type Catalogo = { id: string; nombre: string }

export type MuestraFiltersState = {
  q: string
  articulo: string
  color: string
  lote: string
  tintoreria: string
  ubicacion: string
  estado: string
  orden: string
}

export default function NuevaMuestraForm({
  rollos,
  articulos,
  colores,
  tintorerias,
  clientes,
  lotes,
  ubicaciones,
  current,
}: {
  rollos: RolloOpcion[]
  articulos: Catalogo[]
  colores: Catalogo[]
  tintorerias: Catalogo[]
  clientes: Catalogo[]
  lotes: string[]
  ubicaciones: UbicacionOption[]
  current: MuestraFiltersState
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [rolloId, setRolloId] = useState('')
  const [kilos, setKilos] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteManual, setClienteManual] = useState('')
  const [clienteModoManual, setClienteModoManual] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ubicacionOptions = ubicacionesToOptions(ubicaciones)

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

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clienteId, clientes]
  )
  const clienteFinal = clienteModoManual
    ? clienteManual.trim()
    : clienteSeleccionado?.nombre.trim() ?? ''
  const clienteOptions = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nombre })),
    [clientes]
  )

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
    if (!clienteFinal) {
      setError('El cliente es obligatorio.')
      return
    }

    startTransition(async () => {
      const res = await registrarMuestra({
        rolloId: rolloElegido.id,
        kilos: kilosNum,
        cliente: clienteFinal,
        motivo,
        pedidoId: null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Muestra de ${kilosNum.toFixed(2)} kg registrada para ${clienteFinal}.`
      )
      router.push('/muestras')
    })
  }

  function updateFilter(field: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(field, value)
    else params.delete(field)
    const qs = params.toString()
    router.replace(qs ? `/muestras/nuevo?${qs}` : '/muestras/nuevo')
  }

  function handleLectura(result: CodeScannerResult) {
    const texto = result.texto.trim().toLowerCase()
    if (!texto) return
    const match = rollos.find((r) => {
      const codigo = r.numero_pieza.toLowerCase()
      return codigo === texto || texto.includes(codigo)
    })
    if (!match) {
      toast.error('No encontramos ese rollo en los filtros actuales.')
      return
    }
    setRolloId(match.id)
    setBusqueda(match.numero_pieza)
    toast.success(`Rollo ${match.numero_pieza} seleccionado.`)
  }

  return (
    <>
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">Filtros</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pieza">
            <input
              defaultValue={current.q}
              onBlur={(e) => updateFilter('q', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateFilter('q', (e.target as HTMLInputElement).value)
                }
              }}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej. 12345"
            />
          </Field>
          <Field label="Artículo">
            <select
              value={current.articulo}
              onChange={(e) => updateFilter('articulo', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Color">
            <select
              value={current.color}
              onChange={(e) => updateFilter('color', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {colores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Partida">
            <select
              value={current.lote}
              onChange={(e) => updateFilter('lote', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {lotes.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tintorería">
            <select
              value={current.tintoreria}
              onChange={(e) => updateFilter('tintoreria', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {tintorerias.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ubicación">
            <SearchableCombobox
              value={current.ubicacion}
              onChange={(value) => updateFilter('ubicacion', value)}
              options={withCurrentUbicacion(current.ubicacion, ubicacionOptions)}
              placeholder="Todas"
              searchPlaceholder="Buscar ubicacion..."
              emptyLabel="No hay ubicaciones"
            />
          </Field>
          <Field label="Estado">
            <select
              value={current.estado}
              onChange={(e) => updateFilter('estado', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="en_stock">En stock</option>
              <option value="reservado">Reservado</option>
              <option value="todos">Todos</option>
            </select>
          </Field>
          <Field label="Orden">
            <select
              value={current.orden}
              onChange={(e) => updateFilter('orden', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="pieza_asc">Pieza A-Z</option>
              <option value="pieza_desc">Pieza Z-A</option>
              <option value="kilos_desc">Kilos mayor a menor</option>
              <option value="kilos_asc">Kilos menor a mayor</option>
            </select>
          </Field>
        </div>
      </section>

      <ScannerByReaderType
        readerType={null}
        onRead={handleLectura}
        paused={pending}
        title="Escanear rollo"
        manualLabel="Ingresar pieza manualmente"
        manualPlaceholder="Ej. 204021911"
      />

      <form onSubmit={handleSubmit} className="space-y-4">

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
                      {r.lote ? ` · ${r.lote}` : ''}
                      {r.ubicacion ? ` · ${r.ubicacion}` : ''}
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
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Cliente <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setClienteModoManual((v) => !v)
                  setClienteId('')
                  setClienteManual('')
                }}
                className="text-xs text-primary hover:underline"
              >
                {clienteModoManual ? 'Elegir del catálogo' : 'Escribir manual'}
              </button>
            </div>
            {clienteModoManual ? (
              <input
                type="text"
                value={clienteManual}
                onChange={(e) => setClienteManual(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
            ) : (
              <SearchableCombobox
                value={clienteId}
                onChange={setClienteId}
                options={clienteOptions}
                placeholder="Seleccionar cliente..."
                searchPlaceholder="Buscar cliente..."
                emptyLabel="No hay clientes. Usá escritura manual."
              />
            )}
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
          disabled={pending || !rolloId || !kilos.trim() || !clienteFinal}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Registrando…' : 'Registrar muestra'}
        </button>
      </div>
      </form>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function withCurrentUbicacion(
  current: string,
  options: { value: string; label: string; description?: string }[]
) {
  if (!current || options.some((o) => o.value === current)) return options
  return [{ value: current, label: current }, ...options]
}
