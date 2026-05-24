'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearIngreso,
  createTintoreriaInline,
  createArticuloInline,
  createColorInline,
  procesarPlanillaConIA,
  type RolloInput,
} from './actions'
import {
  UMBRAL_BAJA_CONFIANZA,
  type IngresoExtraido,
  type Field,
} from '@/lib/extraccion/extraerPlanilla'

type Catalog = { id: string; nombre: string }

type Modo = 'manual' | 'ia'

type Confianzas = {
  numero_remito: number
  fecha: number
  color: number
  ot: number
  rem_tejeduria: number
  referencia: number
  total_rollos_declarado: number
  total_kilos_declarado: number
  rollos: Array<{
    numero_pieza: number
    kilos: number
    metros: number
    ratio: number
    gramaje_planilla: number
    articulo: number
  }>
}

function normNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function emptyRollo(): RolloInput {
  // Todos los rollos arrancan en "pendiente": el operario los confirma uno a
  // uno escaneando el QR cuando llegan al depósito. No se permite saltarse
  // ese paso desde la carga de planilla.
  return {
    numero_pieza: '',
    kilos: '',
    metros: '',
    ratio_rendimiento: '',
    gramaje_planilla: '',
    ubicacion: '',
    estado: 'pendiente',
  }
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? '' : String(v)
}

function valOf<T>(f: Field<T>): string {
  if (f.value === null || f.value === undefined) return ''
  return String(f.value)
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function celdaCls(confianza: number | undefined): string {
  if (confianza === undefined) return 'border-input'
  return confianza < UMBRAL_BAJA_CONFIANZA
    ? 'border-warning ring-1 ring-warning/40'
    : 'border-input'
}

export default function NuevoIngresoForm({
  tintorerias: initialTintorerias,
  articulos: initialArticulos,
  colores: initialColores,
  role,
}: {
  tintorerias: Catalog[]
  articulos: Catalog[]
  colores: Catalog[]
  role: 'operario' | 'admin'
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tintorerias, setTintorerias] = useState(initialTintorerias)
  const [articulos, setArticulos] = useState(initialArticulos)
  const [colores, setColores] = useState(initialColores)

  const [modo, setModo] = useState<Modo>('manual')

  const [archivo, setArchivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imagenPath, setImagenPath] = useState<string | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [extraccionError, setExtraccionError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [confianzas, setConfianzas] = useState<Confianzas | null>(null)

  const [tintoreriaId, setTintoreriaId] = useState('')
  const [articuloId, setArticuloId] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [numeroRemito, setNumeroRemito] = useState('')
  const [color, setColor] = useState('')
  const [ot, setOt] = useState('')
  const [remTejeduria, setRemTejeduria] = useState('')
  const [referencia, setReferencia] = useState('')
  const [totalRollosDeclarado, setTotalRollosDeclarado] = useState('')
  const [totalKilosDeclarado, setTotalKilosDeclarado] = useState('')

  const [rollos, setRollos] = useState<RolloInput[]>([emptyRollo()])
  const [bulkUbicacion, setBulkUbicacion] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function updateRollo<K extends keyof RolloInput>(
    idx: number,
    field: K,
    value: RolloInput[K]
  ) {
    setRollos(rollos.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setRollos([...rollos, emptyRollo()])
  }

  function removeRow(idx: number) {
    if (rollos.length === 1) {
      setRollos([emptyRollo()])
    } else {
      setRollos(rollos.filter((_, i) => i !== idx))
    }
    if (confianzas) {
      const nuevas = { ...confianzas }
      nuevas.rollos = nuevas.rollos.filter((_, i) => i !== idx)
      setConfianzas(nuevas)
    }
  }

  function applyBulkUbicacion() {
    if (!bulkUbicacion.trim()) return
    setRollos(rollos.map((r) => ({ ...r, ubicacion: bulkUbicacion.trim() })))
  }

  function resetIA() {
    setArchivo(null)
    setPreviewUrl(null)
    setImagenPath(null)
    setExtrayendo(false)
    setExtraccionError(null)
    setWarnings([])
    setConfianzas(null)
  }

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return
    if (nuevo === 'manual') resetIA()
    setModo(nuevo)
  }

  async function handleArchivoSeleccionado(file: File) {
    if (!tintoreriaId) {
      setExtraccionError('Primero seleccioná la tintorería arriba.')
      return
    }
    setArchivo(file)
    setExtraccionError(null)
    setWarnings([])
    setConfianzas(null)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }

    setExtrayendo(true)
    const formData = new FormData()
    formData.set('archivo', file)
    formData.set('tintoreria_id', tintoreriaId)
    const result = await procesarPlanillaConIA(formData)
    setExtrayendo(false)

    if (!result.ok) {
      setExtraccionError(result.error)
      if (result.imagen_path) setImagenPath(result.imagen_path)
      return
    }

    setImagenPath(result.imagen_path)
    setWarnings(result.warnings)
    aplicarDatosIA(result.datos)
  }

  function aplicarDatosIA(datos: IngresoExtraido) {
    setNumeroRemito(valOf(datos.numero_remito))
    if (datos.fecha.value) setFecha(datos.fecha.value)

    const colorExtraido = datos.color.value?.trim() ?? ''
    if (colorExtraido) {
      const colorNorm = colorExtraido
        .toLowerCase()
        .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
      const match = colores.find((c) => c.nombre === colorNorm)
      setColor(match ? match.nombre : '')
    } else {
      setColor('')
    }
    setOt(valOf(datos.ot))
    setRemTejeduria(valOf(datos.rem_tejeduria))
    setReferencia(valOf(datos.referencia))
    setTotalRollosDeclarado(
      datos.total_rollos_declarado.value !== null
        ? String(datos.total_rollos_declarado.value)
        : ''
    )
    setTotalKilosDeclarado(
      datos.total_kilos_declarado.value !== null
        ? String(datos.total_kilos_declarado.value)
        : ''
    )

    const articulosByName = new Map(
      articulos.map((a) => [normNombre(a.nombre), a.id])
    )

    const rollosFromIA: RolloInput[] = datos.rollos.map((r) => {
      const articuloNombre = r.articulo?.value?.trim() ?? ''
      const articuloIdMatch = articuloNombre
        ? articulosByName.get(normNombre(articuloNombre)) ?? null
        : null
      return {
        numero_pieza: valOf(r.numero_pieza),
        kilos: fmt(r.kilos.value),
        metros: fmt(r.metros.value),
        ratio_rendimiento: fmt(r.ratio.value),
        gramaje_planilla: fmt(r.gramaje_planilla.value),
        ubicacion: '',
        estado: 'pendiente',
        articulo_id: articuloIdMatch,
        confianza_ia: avg([
          r.numero_pieza.confidence,
          r.kilos.confidence,
          r.metros.confidence,
          r.ratio.confidence,
          r.gramaje_planilla.confidence,
        ]),
      }
    })
    setRollos(rollosFromIA.length > 0 ? rollosFromIA : [emptyRollo()])

    setConfianzas({
      numero_remito: datos.numero_remito.confidence,
      fecha: datos.fecha.confidence,
      color: datos.color.confidence,
      ot: datos.ot.confidence,
      rem_tejeduria: datos.rem_tejeduria.confidence,
      referencia: datos.referencia.confidence,
      total_rollos_declarado: datos.total_rollos_declarado.confidence,
      total_kilos_declarado: datos.total_kilos_declarado.confidence,
      rollos: datos.rollos.map((r) => ({
        numero_pieza: r.numero_pieza.confidence,
        kilos: r.kilos.confidence,
        metros: r.metros.confidence,
        ratio: r.ratio.confidence,
        gramaje_planilla: r.gramaje_planilla.confidence,
        articulo: r.articulo?.confidence ?? 0,
      })),
    })
  }

  const validations = useMemo(() => {
    const sumaKilos = rollos.reduce(
      (acc, r) => acc + (parseFloat(r.kilos) || 0),
      0
    )
    const cantidadRollos = rollos.filter((r) => r.numero_pieza.trim()).length

    const numeros = rollos.map((r) => r.numero_pieza.trim()).filter(Boolean)
    const seen = new Set<string>()
    const duplicadosSet = new Set<string>()
    for (const n of numeros) {
      if (seen.has(n)) duplicadosSet.add(n)
      seen.add(n)
    }
    const duplicados = Array.from(duplicadosSet)

    const totalRollosNum = parseInt(totalRollosDeclarado) || null
    const totalKilosNum = parseFloat(totalKilosDeclarado) || null

    const cantidadCoincide =
      totalRollosNum === null || totalRollosNum === cantidadRollos
    const kilosCoinciden =
      totalKilosNum === null || Math.abs(totalKilosNum - sumaKilos) < 0.01

    return {
      sumaKilos,
      cantidadRollos,
      duplicados,
      cantidadCoincide,
      kilosCoinciden,
    }
  }, [rollos, totalRollosDeclarado, totalKilosDeclarado])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const result = await crearIngreso({
      tintoreria_id: tintoreriaId,
      articulo_id: articuloId,
      fecha,
      numero_remito: numeroRemito,
      color,
      ot,
      rem_tejeduria: remTejeduria,
      referencia,
      total_rollos_declarado: totalRollosDeclarado,
      total_kilos_declarado: totalKilosDeclarado,
      imagen_path: imagenPath ?? undefined,
      origen: modo === 'ia' ? 'planilla_ia' : 'manual',
      rollos: rollos.filter((r) => r.numero_pieza.trim()),
    })

    if (result?.error) {
      setSubmitError(result.error)
      setSubmitting(false)
    }
  }

  const blockSubmit =
    submitting ||
    extrayendo ||
    !tintoreriaId ||
    !articuloId ||
    !fecha ||
    validations.cantidadRollos === 0 ||
    validations.duplicados.length > 0 ||
    !validations.cantidadCoincide ||
    !validations.kilosCoinciden

  // En modo IA, una vez subida la planilla, la tintorería queda fija
  // (cambiarla = cambiar config = empezar de cero)
  const tintoreriaBloqueada = modo === 'ia' && archivo !== null

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      {/* Toggle modo */}
      <div className="rounded-lg border bg-white p-3 sm:p-4 shadow-sm grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cambiarModo('manual')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            modo === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'bg-zinc-100 hover:bg-zinc-200'
          }`}
        >
          Cargar a mano
        </button>
        <button
          type="button"
          onClick={() => cambiarModo('ia')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            modo === 'ia'
              ? 'bg-primary text-primary-foreground'
              : 'bg-zinc-100 hover:bg-zinc-200'
          }`}
        >
          Planilla con IA
        </button>
      </div>

      {/* Modo IA: paso 1 (tintorería) + paso 2 (upload) */}
      {modo === 'ia' && (
        <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm space-y-4">
          {/* Paso 1: tintorería */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <label className="text-sm font-medium">
                Tintorería de la que viene la planilla *
              </label>
            </div>
            <select
              value={tintoreriaId}
              onChange={(e) => setTintoreriaId(e.target.value)}
              disabled={tintoreriaBloqueada}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-zinc-50 disabled:cursor-not-allowed"
            >
              <option value="">Seleccionar tintorería...</option>
              {tintorerias.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {!tintoreriaBloqueada && role === 'admin' && (
              <InlineCreator
                label="+ Nueva tintorería"
                placeholder="Nombre de la tintorería"
                onCreate={async (nombre) => {
                  const res = await createTintoreriaInline(nombre)
                  if (res.success && res.data) {
                    setTintorerias([
                      ...tintorerias,
                      { id: res.data.id, nombre: res.data.nombre },
                    ])
                    setTintoreriaId(res.data.id)
                  }
                  return res
                }}
              />
            )}
            <p className="text-xs text-muted-foreground">
              La IA usa instrucciones específicas según el formato de cada
              tintorería.
            </p>
          </div>

          {/* Paso 2: upload (solo aparece si hay tintorería elegida) */}
          {tintoreriaId && (
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    archivo
                      ? 'bg-success text-success-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  2
                </span>
                <label className="text-sm font-medium">Subir planilla</label>
              </div>

              {!archivo && !extrayendo && !extraccionError && (
                <UploadArea
                  onFile={handleArchivoSeleccionado}
                  fileInputRef={fileInputRef}
                />
              )}

              {extrayendo && (
                <div className="flex items-center gap-3 rounded-md bg-zinc-50 px-4 py-6 text-sm">
                  <Spinner />
                  <div>
                    <p className="font-medium">Procesando planilla con IA...</p>
                    <p className="text-xs text-muted-foreground">
                      Esto suele tomar 5-10 segundos.
                    </p>
                  </div>
                </div>
              )}

              {extraccionError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:p-4 space-y-3">
                  <p className="text-sm font-medium text-destructive">
                    ⚠ La IA no pudo procesar la planilla
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    {extraccionError}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        archivo && handleArchivoSeleccionado(archivo)
                      }
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Reintentar IA
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarModo('manual')}
                      className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
                    >
                      Cargar a mano
                    </button>
                    <button
                      type="button"
                      onClick={resetIA}
                      className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
                    >
                      Subir otra
                    </button>
                  </div>
                </div>
              )}

              {archivo && !extrayendo && !extraccionError && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-md border bg-zinc-50 p-3">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Planilla"
                        className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded bg-zinc-200 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                        PDF
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {archivo.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(archivo.size / 1024).toFixed(1)} KB · datos extraídos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetIA}
                      className="text-xs text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      Quitar
                    </button>
                  </div>

                  {warnings.length > 0 && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-foreground">
                          💡 {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Header del ingreso */}
      <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <h2 className="font-semibold">Datos del ingreso</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* En manual: dropdown de tintorería. En IA: ya se eligió en step 1. */}
          {modo === 'manual' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Tintorería *</label>
              <select
                value={tintoreriaId}
                onChange={(e) => setTintoreriaId(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {tintorerias.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              {role === 'admin' && (
                <InlineCreator
                  label="+ Nueva tintorería"
                  placeholder="Nombre de la tintorería"
                  onCreate={async (nombre) => {
                    const res = await createTintoreriaInline(nombre)
                    if (res.success && res.data) {
                      setTintorerias([
                        ...tintorerias,
                        { id: res.data.id, nombre: res.data.nombre },
                      ])
                      setTintoreriaId(res.data.id)
                    }
                    return res
                  }}
                />
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Artículo principal *</label>
            <select
              value={articuloId}
              onChange={(e) => setArticuloId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar...</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Se aplica a rollos sin selección propia. Cambialo en la tabla si la planilla trae varios artículos.
            </p>
            <InlineCreator
              label="+ Nuevo artículo"
              placeholder="Nombre del artículo"
              onCreate={async (nombre) => {
                const res = await createArticuloInline(nombre)
                if (res.success && res.data) {
                  setArticulos([...articulos, res.data])
                  setArticuloId(res.data.id)
                }
                return res
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.fecha)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Número de remito</label>
            <input
              type="text"
              value={numeroRemito}
              onChange={(e) => setNumeroRemito(e.target.value)}
              placeholder="Ej: 49447"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.numero_remito)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Color</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.color)}`}
            >
              <option value="">Seleccionar...</option>
              {colores.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <InlineCreator
              label="+ Nuevo color"
              placeholder="Nombre del color"
              onCreate={async (nombre) => {
                const res = await createColorInline(nombre)
                if (res.success && res.data) {
                  if (!colores.find((c) => c.id === res.data.id)) {
                    setColores([...colores, res.data])
                  }
                  setColor(res.data.nombre)
                }
                return res
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Total de rollos declarado
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalRollosDeclarado}
              onChange={(e) => setTotalRollosDeclarado(e.target.value)}
              placeholder="Ej: 24"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.total_rollos_declarado)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Total de kilos declarado
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={totalKilosDeclarado}
              onChange={(e) => setTotalKilosDeclarado(e.target.value)}
              placeholder="Ej: 480.50"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.total_kilos_declarado)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">OT</label>
            <input
              type="text"
              value={ot}
              onChange={(e) => setOt(e.target.value)}
              placeholder="Orden de trabajo"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.ot)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Remito tejeduría</label>
            <input
              type="text"
              value={remTejeduria}
              onChange={(e) => setRemTejeduria(e.target.value)}
              placeholder="Remito de la tejeduría"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.rem_tejeduria)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Referencia</label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: SBI"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${celdaCls(confianzas?.referencia)}`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Ubicación inicial</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bulkUbicacion}
                onChange={(e) => setBulkUbicacion(e.target.value)}
                placeholder="Ej. A1"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={applyBulkUbicacion}
                disabled={!bulkUbicacion.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Aplicar a todos
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se copia a cada rollo. Podés sobrescribir individualmente en la tabla.
            </p>
          </div>
        </div>
      </div>

      {/* Rollos */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-3 border-b bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Rollos</h2>
          <span className="text-xs text-muted-foreground">
            {validations.cantidadRollos} cargados · suma{' '}
            {validations.sumaKilos.toFixed(2)} kg
          </span>
        </div>

        {/* Mobile: cards apilados */}
        <div className="sm:hidden divide-y">
          {rollos.map((r, i) => (
            <RolloCardMobile
              key={i}
              rollo={r}
              index={i}
              articulos={articulos}
              confianzas={confianzas?.rollos[i]}
              isDuplicate={
                !!r.numero_pieza.trim() &&
                validations.duplicados.includes(r.numero_pieza.trim())
              }
              onUpdate={(field, value) => updateRollo(i, field, value)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>

        {/* Desktop: tabla */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium">N° Pieza *</th>
                <th className="px-3 py-2 font-medium w-40">Artículo</th>
                <th className="px-3 py-2 font-medium w-24">Kilos</th>
                <th className="px-3 py-2 font-medium w-24">Metros</th>
                <th className="px-3 py-2 font-medium w-20">Ratio</th>
                <th className="px-3 py-2 font-medium w-20">Gramaje</th>
                <th className="px-3 py-2 font-medium w-32">Estado</th>
                <th className="px-3 py-2 font-medium w-28">Ubicación</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rollos.map((r, i) => {
                const conf = confianzas?.rollos[i]
                const isDuplicate =
                  r.numero_pieza.trim() &&
                  validations.duplicados.includes(r.numero_pieza.trim())
                return (
                  <tr
                    key={i}
                    className={`border-b last:border-0 ${
                      isDuplicate ? 'bg-destructive/5' : ''
                    }`}
                  >
                    <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1">
                      <input
                        type="text"
                        value={r.numero_pieza}
                        onChange={(e) =>
                          updateRollo(i, 'numero_pieza', e.target.value)
                        }
                        placeholder="204021911"
                        className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${
                          isDuplicate
                            ? 'border-destructive'
                            : celdaCls(conf?.numero_pieza)
                        }`}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <select
                        value={r.articulo_id ?? ''}
                        onChange={(e) =>
                          updateRollo(
                            i,
                            'articulo_id',
                            e.target.value || null
                          )
                        }
                        className={`w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.articulo)}`}
                      >
                        <option value="">Principal</option>
                        {articulos.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={r.kilos}
                        onChange={(e) => updateRollo(i, 'kilos', e.target.value)}
                        placeholder="20.5"
                        className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.kilos)}`}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={r.metros}
                        onChange={(e) =>
                          updateRollo(i, 'metros', e.target.value)
                        }
                        placeholder="50"
                        className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.metros)}`}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={r.ratio_rendimiento}
                        onChange={(e) =>
                          updateRollo(i, 'ratio_rendimiento', e.target.value)
                        }
                        placeholder="2.4"
                        className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.ratio)}`}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={r.gramaje_planilla ?? ''}
                        onChange={(e) =>
                          updateRollo(i, 'gramaje_planilla', e.target.value)
                        }
                        placeholder="142"
                        className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.gramaje_planilla)}`}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-warning">
                        Pendiente
                      </span>
                    </td>
                    <td className="px-3 py-1">
                      <input
                        type="text"
                        value={r.ubicacion}
                        onChange={(e) =>
                          updateRollo(i, 'ubicacion', e.target.value)
                        }
                        placeholder="opcional"
                        className="w-full rounded border border-input px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-muted-foreground hover:text-destructive text-lg leading-none"
                        aria-label="Eliminar fila"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-3 sm:px-4 py-3 border-t bg-zinc-50">
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Agregar fila
          </button>
        </div>
      </div>

      {/* Validaciones / warnings */}
      {(validations.duplicados.length > 0 ||
        !validations.cantidadCoincide ||
        !validations.kilosCoinciden) && (
        <div className="rounded-lg border bg-warning/10 border-warning/30 p-3 sm:p-4 space-y-1 text-sm">
          {validations.duplicados.length > 0 && (
            <p className="text-destructive">
              ⚠ Números de pieza duplicados:{' '}
              {validations.duplicados.join(', ')}
            </p>
          )}
          {!validations.cantidadCoincide && (
            <p className="text-destructive">
              ⚠ Cargaste {validations.cantidadRollos} rollos, pero declaraste{' '}
              {totalRollosDeclarado}. Ajustá la cantidad declarada o agregá los rollos faltantes para poder guardar.
            </p>
          )}
          {!validations.kilosCoinciden && (
            <p className="text-destructive">
              ⚠ Suma de kilos {validations.sumaKilos.toFixed(2)} kg vs{' '}
              {totalKilosDeclarado} kg declarados. Ajustá el total declarado o corregí los kilos por rollo.
            </p>
          )}
        </div>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => router.push('/ingresos')}
          className="rounded-md border bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={blockSubmit}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Guardando...' : 'Guardar ingreso'}
        </button>
      </div>
    </form>
  )
}

// ── Card de rollo (mobile) ──────────────────────────────────

function RolloCardMobile({
  rollo,
  index,
  articulos,
  confianzas,
  isDuplicate,
  onUpdate,
  onRemove,
}: {
  rollo: RolloInput
  index: number
  articulos: Catalog[]
  confianzas:
    | {
        numero_pieza: number
        kilos: number
        metros: number
        ratio: number
        gramaje_planilla: number
      }
    | undefined
  isDuplicate: boolean
  onUpdate: <K extends keyof RolloInput>(field: K, value: RolloInput[K]) => void
  onRemove: () => void
}) {
  return (
    <div className={`p-3 space-y-2 ${isDuplicate ? 'bg-destructive/5' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive text-xl leading-none px-2"
          aria-label="Eliminar fila"
        >
          ×
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          N° Pieza *
        </label>
        <input
          type="text"
          value={rollo.numero_pieza}
          onChange={(e) => onUpdate('numero_pieza', e.target.value)}
          placeholder="204021911"
          className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${
            isDuplicate
              ? 'border-destructive'
              : celdaCls(confianzas?.numero_pieza)
          }`}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Artículo
        </label>
        <select
          value={rollo.articulo_id ?? ''}
          onChange={(e) => onUpdate('articulo_id', e.target.value || null)}
          className="w-full rounded border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Principal (del header)</option>
          {articulos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Kilos
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rollo.kilos}
            onChange={(e) => onUpdate('kilos', e.target.value)}
            placeholder="20.5"
            className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(confianzas?.kilos)}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Metros
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rollo.metros}
            onChange={(e) => onUpdate('metros', e.target.value)}
            placeholder="50"
            className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(confianzas?.metros)}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Ratio
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rollo.ratio_rendimiento}
            onChange={(e) => onUpdate('ratio_rendimiento', e.target.value)}
            placeholder="2.4"
            className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(confianzas?.ratio)}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Gramaje
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rollo.gramaje_planilla ?? ''}
            onChange={(e) => onUpdate('gramaje_planilla', e.target.value)}
            placeholder="142"
            className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(confianzas?.gramaje_planilla)}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <div className="flex h-[42px] items-center rounded border border-input bg-background px-3">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-warning">
              Pendiente
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Ubicación
          </label>
          <input
            type="text"
            value={rollo.ubicacion}
            onChange={(e) => onUpdate('ubicacion', e.target.value)}
            placeholder="opcional"
            className="w-full rounded border border-input px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  )
}

// ── Auxiliares ──────────────────────────────────────────────

function UploadArea({
  onFile,
  fileInputRef,
}: {
  onFile: (file: File) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 sm:p-8 cursor-pointer transition-colors ${
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-input hover:bg-zinc-50'
      }`}
    >
      <p className="text-sm font-medium text-center">
        Arrastrá la planilla acá o tocá para elegir
      </p>
      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG, WebP, HEIC o PDF
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </label>
  )
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  )
}

function InlineCreator({
  label,
  placeholder,
  onCreate,
}: {
  label: string
  placeholder: string
  onCreate: (
    nombre: string
  ) => Promise<{
    success?: boolean
    data?: { id: string; nombre: string }
    error?: string
  }>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    const res = await onCreate(value)
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setValue('')
      setOpen(false)
    }
  }

  function reset() {
    setOpen(false)
    setValue('')
    setError(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            } else if (e.key === 'Escape') {
              reset()
            }
          }}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !value.trim()}
            className="flex-1 sm:flex-initial rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex-1 sm:flex-initial rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
