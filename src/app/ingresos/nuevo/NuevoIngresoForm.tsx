'use client'

import { Fragment, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, X } from 'lucide-react'
import {
  crearIngreso,
  procesarPlanillaConIA,
  subirFotoFalla,
  type RolloInput,
} from './actions'
import { createColor, solicitarColor } from '@/app/admin/colores/actions'
import {
  UMBRAL_BAJA_CONFIANZA,
  type IngresoExtraido,
  type Field,
} from '@/lib/extraccion/extraerPlanilla'

type Catalog = { id: string; nombre: string }
type ArticuloCatalog = { id: string; nombre: string; colores: Catalog[] }

type Modo = 'manual' | 'ia'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

type Confianzas = {
  numero_remito: number
  fecha: number
  ot: number
  rem_tejeduria: number
  referencia: number
  total_rollos_declarado: number
  total_kilos_declarado: number
  rollos: Array<{
    numero_pieza: number
    kilos: number
    metros: number
    rinde: number
    gramaje_planilla: number
    articulo: number
    color: number
  }>
}

const FALLA_CATEGORIAS: { value: string; label: string }[] = [
  { value: 'mancha', label: 'Mancha' },
  { value: 'agujero', label: 'Agujero' },
  { value: 'color_disparejo', label: 'Color disparejo' },
  { value: 'tono_diferente', label: 'Tono diferente' },
  { value: 'rotura_tejido', label: 'Rotura de tejido' },
  { value: 'otro', label: 'Otro' },
]

function normNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function normColor(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

function emptyRollo(): RolloInput {
  return {
    numero_pieza: '',
    kilos: '',
    metros: '',
    rinde: '',
    gramaje_planilla: '',
    ubicacion: '',
    estado: 'pendiente',
    articulo_id: null,
    color_id: null,
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

/**
 * Estado UI por rollo para la foto de segunda calidad. Mantenemos el
 * `File` cliente-side hasta el submit; ahí lo subimos al bucket y lo
 * persistimos en `rollos[].foto_falla_path` que viaja al server.
 */
type FotoPendiente = { file: File; previewUrl: string }

export default function NuevoIngresoForm({
  tintorerias: initialTintorerias,
  articulos: initialArticulos,
  colores: initialColores,
  role,
}: {
  tintorerias: Catalog[]
  articulos: ArticuloCatalog[]
  colores: Catalog[]
  role: Role
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tintorerias = initialTintorerias
  const [articulos] = useState(initialArticulos)
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
  const [fecha, setFecha] = useState(todayISO())
  const [numeroRemito, setNumeroRemito] = useState('')
  const [ot, setOt] = useState('')
  const [remTejeduria, setRemTejeduria] = useState('')
  const [referencia, setReferencia] = useState('')
  const [totalRollosDeclarado, setTotalRollosDeclarado] = useState('')
  const [totalKilosDeclarado, setTotalKilosDeclarado] = useState('')

  const [rollos, setRollos] = useState<RolloInput[]>([emptyRollo()])
  const [fotosFalla, setFotosFalla] = useState<Record<number, FotoPendiente>>({})
  const [bulkUbicacion, setBulkUbicacion] = useState('')
  const [bulkArticuloId, setBulkArticuloId] = useState('')
  const [bulkColorId, setBulkColorId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function updateRollo<K extends keyof RolloInput>(
    idx: number,
    field: K,
    value: RolloInput[K]
  ) {
    setRollos((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    )
  }

  /**
   * Cuando cambia el artículo de un rollo, validamos que el color
   * seleccionado siga disponible para ese artículo. Si no, lo limpiamos
   * para que el usuario elija uno asociado.
   */
  function setRolloArticulo(idx: number, nuevoArticuloId: string | null) {
    setRollos((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const articulo = articulos.find((a) => a.id === nuevoArticuloId)
        const colorSigueValido = articulo?.colores.some(
          (c) => c.id === r.color_id
        )
        return {
          ...r,
          articulo_id: nuevoArticuloId,
          color_id: colorSigueValido ? r.color_id : null,
        }
      })
    )
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
    setFotosFalla((prev) => {
      const next: Record<number, FotoPendiente> = {}
      for (const [k, v] of Object.entries(prev)) {
        const kNum = Number(k)
        if (kNum < idx) next[kNum] = v
        else if (kNum > idx) next[kNum - 1] = v
      }
      return next
    })
  }

  function toggleSegunda(idx: number, valor: boolean) {
    setRollos((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              segunda: valor,
              // Al destildar, limpiar campos asociados.
              falla_categoria: valor ? r.falla_categoria : null,
              falla_descripcion: valor ? r.falla_descripcion : null,
            }
          : r
      )
    )
    if (!valor) {
      setFotosFalla((prev) => {
        const next = { ...prev }
        delete next[idx]
        return next
      })
    }
  }

  function setFotoFalla(idx: number, file: File | null) {
    setFotosFalla((prev) => {
      const next = { ...prev }
      if (file) {
        const previewUrl = URL.createObjectURL(file)
        next[idx] = { file, previewUrl }
      } else {
        if (prev[idx]) URL.revokeObjectURL(prev[idx].previewUrl)
        delete next[idx]
      }
      return next
    })
  }

  function applyBulkUbicacion() {
    if (!bulkUbicacion.trim()) return
    setRollos(rollos.map((r) => ({ ...r, ubicacion: bulkUbicacion.trim() })))
  }

  function applyBulkArticulo() {
    if (!bulkArticuloId) return
    setRollos((prev) =>
      prev.map((r) => {
        const articulo = articulos.find((a) => a.id === bulkArticuloId)
        const colorSigueValido = articulo?.colores.some(
          (c) => c.id === r.color_id
        )
        return {
          ...r,
          articulo_id: bulkArticuloId,
          color_id: colorSigueValido ? r.color_id : null,
        }
      })
    )
  }

  function applyBulkColor() {
    if (!bulkColorId) return
    setRollos((prev) =>
      prev.map((r) => {
        const articulo = articulos.find((a) => a.id === r.articulo_id)
        const colorPertenece = articulo?.colores.some(
          (c) => c.id === bulkColorId
        )
        if (!colorPertenece) return r
        return { ...r, color_id: bulkColorId }
      })
    )
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

    // Resolución de color: matchea el texto extraído contra el catálogo
    // por nombre normalizado. Devuelve el ID o null.
    function colorIdFromText(raw: string | null | undefined): string | null {
      const norm = normColor(raw)
      if (!norm) return null
      return colores.find((c) => c.nombre === norm)?.id ?? null
    }
    const colorGlobalId = colorIdFromText(datos.color.value)
    if (colorGlobalId) setBulkColorId(colorGlobalId)

    // Match de artículo por nombre. Si la combinación (articulo, color)
    // no está asociada en la pivot, el server rechazaría con FK 23503.
    // Acá filtramos: si el color global no está en los colores del articulo
    // encontrado, dejamos color_id en null para que el usuario lo elija.
    function articuloIdFromText(nombreRaw: string): string | null {
      const nombreNorm = normNombre(nombreRaw)
      if (!nombreNorm) return null
      const match = articulos.find((a) => normNombre(a.nombre) === nombreNorm)
      return match?.id ?? null
    }

    const rollosFromIA: RolloInput[] = datos.rollos.map((r) => {
      const articuloNombre = r.articulo?.value?.trim() ?? ''
      const articuloId = articuloIdFromText(articuloNombre)
      const colorRolloId = colorIdFromText(r.color?.value)
      const colorEfectivoId = colorRolloId ?? colorGlobalId

      // Si la combinación (articulo, color) no existe en la pivot,
      // limpiar color_id para forzar que el usuario lo elija.
      const articulo = articuloId
        ? articulos.find((a) => a.id === articuloId)
        : null
      const colorValido =
        articulo?.colores.some((c) => c.id === colorEfectivoId) ?? false

      return {
        numero_pieza: valOf(r.numero_pieza),
        kilos: fmt(r.kilos.value),
        metros: fmt(r.metros.value),
        rinde: fmt(r.ratio.value),
        gramaje_planilla: fmt(r.gramaje_planilla.value),
        ubicacion: '',
        estado: 'pendiente',
        articulo_id: articuloId,
        color_id: colorValido ? colorEfectivoId : null,
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
      ot: datos.ot.confidence,
      rem_tejeduria: datos.rem_tejeduria.confidence,
      referencia: datos.referencia.confidence,
      total_rollos_declarado: datos.total_rollos_declarado.confidence,
      total_kilos_declarado: datos.total_kilos_declarado.confidence,
      rollos: datos.rollos.map((r) => ({
        numero_pieza: r.numero_pieza.confidence,
        kilos: r.kilos.confidence,
        metros: r.metros.confidence,
        rinde: r.ratio.confidence,
        gramaje_planilla: r.gramaje_planilla.confidence,
        articulo: r.articulo?.confidence ?? 0,
        color:
          (r.color?.value?.trim()
            ? r.color?.confidence
            : datos.color.value?.trim()
              ? datos.color.confidence
              : 0) ?? 0,
      })),
    })
  }

  const validations = useMemo(() => {
    const sumaKilos = rollos.reduce(
      (acc, r) => acc + (parseFloat(r.kilos) || 0),
      0
    )
    const rollosConPieza = rollos.filter((r) => r.numero_pieza.trim())
    const cantidadRollos = rollosConPieza.length

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

    const rollosSinArticulo = rollosConPieza.filter((r) => !r.articulo_id).length
    const rollosSinColor = rollosConPieza.filter((r) => !r.color_id).length
    const rollosSegundaSinCategoria = rollosConPieza.filter(
      (r) => r.segunda && !r.falla_categoria
    ).length

    return {
      sumaKilos,
      cantidadRollos,
      duplicados,
      cantidadCoincide,
      kilosCoinciden,
      rollosSinArticulo,
      rollosSinColor,
      rollosSegundaSinCategoria,
    }
  }, [rollos, totalRollosDeclarado, totalKilosDeclarado])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    // Subir fotos de falla en paralelo y atar el path al rollo correspondiente.
    const rollosFiltrados = rollos.filter((r) => r.numero_pieza.trim())
    const rollosConFoto: RolloInput[] = await Promise.all(
      rollosFiltrados.map(async (r) => {
        // Buscar la fotoPendiente cuyo índice apunta a este rollo en la
        // lista filtrada. fotosFalla está indexada por idx en `rollos`
        // (no filtrado). Resolvemos el mapeo recorriendo.
        const idxEnTodos = rollos.indexOf(r)
        const foto = fotosFalla[idxEnTodos]
        if (!foto || !r.segunda) return r
        const fd = new FormData()
        fd.set('archivo', foto.file)
        const res = await subirFotoFalla(fd)
        if (!res.ok) {
          throw new Error(`No se pudo subir la foto del rollo ${r.numero_pieza}: ${res.error}`)
        }
        return { ...r, foto_falla_path: res.path }
      })
    ).catch((err) => {
      setSubmitError(err instanceof Error ? err.message : 'Error subiendo fotos.')
      setSubmitting(false)
      return null as unknown as RolloInput[]
    })

    if (!rollosConFoto) return

    const result = await crearIngreso({
      tintoreria_id: tintoreriaId,
      fecha,
      numero_remito: numeroRemito,
      ot,
      rem_tejeduria: remTejeduria,
      referencia,
      total_rollos_declarado: totalRollosDeclarado,
      total_kilos_declarado: totalKilosDeclarado,
      imagen_path: imagenPath ?? undefined,
      origen: modo === 'ia' ? 'planilla_ia' : 'manual',
      rollos: rollosConFoto,
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
    !fecha ||
    validations.cantidadRollos === 0 ||
    validations.duplicados.length > 0 ||
    validations.rollosSinArticulo > 0 ||
    validations.rollosSinColor > 0 ||
    validations.rollosSegundaSinCategoria > 0 ||
    !validations.cantidadCoincide ||
    !validations.kilosCoinciden

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

      {/* Modo IA */}
      {modo === 'ia' && (
        <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm space-y-4">
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
          </div>

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
            </div>
          )}

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
        </div>
      </div>

      {/* Atajos bulk */}
      <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <h2 className="font-semibold">Asignar a todos los rollos</h2>
          <p className="text-xs text-muted-foreground">
            Atajo opcional. Lo que pongas acá se copia a todos los rollos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Artículo</label>
            <div className="flex gap-2">
              <select
                value={bulkArticuloId}
                onChange={(e) => setBulkArticuloId(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyBulkArticulo}
                disabled={!bulkArticuloId}
                className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Aplicar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              ¿Falta un artículo?{' '}
              <a href="/admin/articulos" className="underline">
                Crealo desde administración
              </a>
              .
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2">
              <select
                value={bulkColorId}
                onChange={(e) => setBulkColorId(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {colores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyBulkColor}
                disabled={!bulkColorId}
                className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Aplicar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo se aplica a los rollos cuyo artículo ya incluye ese color.
            </p>
            <SolicitarColorButton
              role={role}
              onCreated={(c) => {
                if (!colores.find((x) => x.id === c.id)) {
                  setColores((prev) => [...prev, c])
                }
                setBulkColorId(c.id)
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Ubicación</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bulkUbicacion}
                onChange={(e) => setBulkUbicacion(e.target.value)}
                placeholder="Ej. A1"
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={applyBulkUbicacion}
                disabled={!bulkUbicacion.trim()}
                className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Aplicar
              </button>
            </div>
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

        {/* Mobile */}
        <div className="sm:hidden divide-y">
          {rollos.map((r, i) => (
            <RolloCardMobile
              key={i}
              rollo={r}
              index={i}
              articulos={articulos}
              fotoFalla={fotosFalla[i]}
              confianzas={confianzas?.rollos[i]}
              isDuplicate={
                !!r.numero_pieza.trim() &&
                validations.duplicados.includes(r.numero_pieza.trim())
              }
              onUpdate={(field, value) => updateRollo(i, field, value)}
              onChangeArticulo={(id) => setRolloArticulo(i, id)}
              onToggleSegunda={(v) => toggleSegunda(i, v)}
              onFotoFalla={(f) => setFotoFalla(i, f)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium">N° Pieza *</th>
                <th className="px-3 py-2 font-medium w-40">Artículo *</th>
                <th className="px-3 py-2 font-medium w-32">Color *</th>
                <th className="px-3 py-2 font-medium w-24">Kilos</th>
                <th className="px-3 py-2 font-medium w-24">Metros</th>
                <th className="px-3 py-2 font-medium w-20">Rinde</th>
                <th className="px-3 py-2 font-medium w-20">Gramaje</th>
                <th className="px-3 py-2 font-medium w-28">Segunda</th>
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
                const articulo = articulos.find((a) => a.id === r.articulo_id)
                const coloresDelArticulo = articulo?.colores ?? []
                return (
                  <Fragment key={i}>
                    <tr
                      className={`border-b last:border-0 ${
                        isDuplicate ? 'bg-destructive/5' : ''
                      } ${r.segunda ? 'bg-amber-50/40' : ''}`}
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
                            setRolloArticulo(i, e.target.value || null)
                          }
                          className={`w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${
                            r.numero_pieza.trim() && !r.articulo_id
                              ? 'border-destructive'
                              : celdaCls(conf?.articulo)
                          }`}
                        >
                          <option value="">Seleccionar...</option>
                          {articulos.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1">
                        <select
                          value={r.color_id ?? ''}
                          onChange={(e) =>
                            updateRollo(i, 'color_id', e.target.value || null)
                          }
                          disabled={!r.articulo_id}
                          className={`w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-zinc-50 disabled:cursor-not-allowed ${
                            r.numero_pieza.trim() && r.articulo_id && !r.color_id
                              ? 'border-destructive'
                              : celdaCls(conf?.color)
                          }`}
                        >
                          <option value="">
                            {r.articulo_id ? 'Seleccionar...' : 'Elegí artículo'}
                          </option>
                          {coloresDelArticulo.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
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
                          value={r.rinde}
                          onChange={(e) =>
                            updateRollo(i, 'rinde', e.target.value)
                          }
                          placeholder="2.4"
                          className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(conf?.rinde)}`}
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
                        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={!!r.segunda}
                            onChange={(e) => toggleSegunda(i, e.target.checked)}
                            className="size-4 rounded border-input text-action focus:ring-1 focus:ring-ring"
                          />
                          Marcar
                        </label>
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

                    {r.segunda && (
                      <tr className="border-b last:border-0 bg-amber-50/40">
                        <td></td>
                        <td colSpan={10} className="px-3 py-3">
                          <SegundaCalidadFields
                            rollo={r}
                            foto={fotosFalla[i]}
                            onUpdate={(field, value) =>
                              updateRollo(i, field, value)
                            }
                            onFoto={(f) => setFotoFalla(i, f)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

      {/* Validaciones */}
      {(validations.duplicados.length > 0 ||
        validations.rollosSinArticulo > 0 ||
        validations.rollosSinColor > 0 ||
        validations.rollosSegundaSinCategoria > 0 ||
        !validations.cantidadCoincide ||
        !validations.kilosCoinciden) && (
        <div className="rounded-lg border bg-warning/10 border-warning/30 p-3 sm:p-4 space-y-1 text-sm">
          {validations.duplicados.length > 0 && (
            <p className="text-destructive">
              ⚠ Números de pieza duplicados:{' '}
              {validations.duplicados.join(', ')}
            </p>
          )}
          {validations.rollosSinArticulo > 0 && (
            <p className="text-destructive">
              ⚠ {validations.rollosSinArticulo} rollo
              {validations.rollosSinArticulo === 1 ? '' : 's'} sin artículo asignado.
            </p>
          )}
          {validations.rollosSinColor > 0 && (
            <p className="text-destructive">
              ⚠ {validations.rollosSinColor} rollo
              {validations.rollosSinColor === 1 ? '' : 's'} sin color asignado.
            </p>
          )}
          {validations.rollosSegundaSinCategoria > 0 && (
            <p className="text-destructive">
              ⚠ {validations.rollosSegundaSinCategoria} rollo
              {validations.rollosSegundaSinCategoria === 1 ? '' : 's'} marcado como segunda sin categoría de falla.
            </p>
          )}
          {!validations.cantidadCoincide && (
            <p className="text-destructive">
              ⚠ Cargaste {validations.cantidadRollos} rollos, pero declaraste{' '}
              {totalRollosDeclarado}.
            </p>
          )}
          {!validations.kilosCoinciden && (
            <p className="text-destructive">
              ⚠ Suma de kilos {validations.sumaKilos.toFixed(2)} kg vs{' '}
              {totalKilosDeclarado} kg declarados.
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

// ── Bloque expandible de segunda calidad ────────────────────

function SegundaCalidadFields({
  rollo,
  foto,
  onUpdate,
  onFoto,
}: {
  rollo: RolloInput
  foto: FotoPendiente | undefined
  onUpdate: <K extends keyof RolloInput>(field: K, value: RolloInput[K]) => void
  onFoto: (file: File | null) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Categoría de falla *
        </label>
        <select
          value={rollo.falla_categoria ?? ''}
          onChange={(e) =>
            onUpdate('falla_categoria', e.target.value || null)
          }
          className={`w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${
            !rollo.falla_categoria ? 'border-destructive' : 'border-input'
          }`}
        >
          <option value="">Seleccionar...</option>
          {FALLA_CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Descripción
        </label>
        <textarea
          value={rollo.falla_descripcion ?? ''}
          onChange={(e) =>
            onUpdate('falla_descripcion', e.target.value || null)
          }
          rows={2}
          placeholder="Ej. mancha de 2cm en el centro del rollo"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Foto de la falla
        </label>
        {foto ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.previewUrl}
              alt="Falla"
              className="h-12 w-12 rounded object-cover border"
            />
            <button
              type="button"
              onClick={() => onFoto(null)}
              className="text-xs text-destructive hover:underline"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1.5 text-xs cursor-pointer hover:bg-zinc-50">
            <Camera className="size-3.5" />
            Sacar / subir foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFoto(f)
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Card de rollo (mobile) ──────────────────────────────────

function RolloCardMobile({
  rollo,
  index,
  articulos,
  fotoFalla,
  confianzas,
  isDuplicate,
  onUpdate,
  onChangeArticulo,
  onToggleSegunda,
  onFotoFalla,
  onRemove,
}: {
  rollo: RolloInput
  index: number
  articulos: ArticuloCatalog[]
  fotoFalla: FotoPendiente | undefined
  confianzas:
    | {
        numero_pieza: number
        kilos: number
        metros: number
        rinde: number
        gramaje_planilla: number
        articulo: number
        color: number
      }
    | undefined
  isDuplicate: boolean
  onUpdate: <K extends keyof RolloInput>(field: K, value: RolloInput[K]) => void
  onChangeArticulo: (id: string | null) => void
  onToggleSegunda: (v: boolean) => void
  onFotoFalla: (file: File | null) => void
  onRemove: () => void
}) {
  const articulo = articulos.find((a) => a.id === rollo.articulo_id)
  const coloresDelArticulo = articulo?.colores ?? []

  return (
    <div
      className={`p-3 space-y-2 ${isDuplicate ? 'bg-destructive/5' : ''} ${
        rollo.segunda ? 'bg-amber-50/40' : ''
      }`}
    >
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
          Artículo *
        </label>
        <select
          value={rollo.articulo_id ?? ''}
          onChange={(e) => onChangeArticulo(e.target.value || null)}
          className={`w-full rounded border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${
            rollo.numero_pieza.trim() && !rollo.articulo_id
              ? 'border-destructive'
              : celdaCls(confianzas?.articulo)
          }`}
        >
          <option value="">Seleccionar...</option>
          {articulos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Color *
        </label>
        <select
          value={rollo.color_id ?? ''}
          onChange={(e) => onUpdate('color_id', e.target.value || null)}
          disabled={!rollo.articulo_id}
          className={`w-full rounded border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-zinc-50 disabled:cursor-not-allowed ${
            rollo.numero_pieza.trim() && rollo.articulo_id && !rollo.color_id
              ? 'border-destructive'
              : celdaCls(confianzas?.color)
          }`}
        >
          <option value="">
            {rollo.articulo_id ? 'Seleccionar...' : 'Elegí artículo primero'}
          </option>
          {coloresDelArticulo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kilos</label>
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
          <label className="text-xs font-medium text-muted-foreground">Metros</label>
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
          <label className="text-xs font-medium text-muted-foreground">Rinde</label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={rollo.rinde}
            onChange={(e) => onUpdate('rinde', e.target.value)}
            placeholder="2.4"
            className={`w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring ${celdaCls(confianzas?.rinde)}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Gramaje</label>
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
        <div className="space-y-1">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground mt-1">
            <input
              type="checkbox"
              checked={!!rollo.segunda}
              onChange={(e) => onToggleSegunda(e.target.checked)}
              className="size-4 rounded border-input text-action focus:ring-1 focus:ring-ring"
            />
            Segunda calidad
          </label>
        </div>
      </div>

      {rollo.segunda && (
        <SegundaCalidadFields
          rollo={rollo}
          foto={fotoFalla}
          onUpdate={onUpdate}
          onFoto={onFotoFalla}
        />
      )}
    </div>
  )
}

// ── Botón "Solicitar color al admin" / "Crear color" ────────

function SolicitarColorButton({
  role,
  onCreated,
}: {
  role: Role
  onCreated: (c: Catalog) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    const limpio = value.trim()
    if (!limpio) return
    startTransition(async () => {
      // El admin puede crear el color directo (tiene permiso). Operario y
      // ventas mandan una solicitud que el admin aprueba desde /admin/colores.
      if (role === 'admin') {
        const res = await createColor({ nombre: limpio })
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
        if ('color' in res && res.color) onCreated(res.color as Catalog)
        toast.success(
          'alreadyExists' in res && res.alreadyExists
            ? `"${limpio}" ya existía en el catálogo.`
            : `Color "${limpio}" creado.`
        )
        setValue('')
        setOpen(false)
        return
      }

      const res = await solicitarColor({ nombre: limpio })
      if ('error' in res) {
        toast.error(res.error ?? 'No se pudo enviar la solicitud.')
        return
      }
      if ('alreadyExists' in res && res.alreadyExists) {
        toast.success(`"${limpio}" ya existe en el catálogo.`)
        onCreated(res.color as Catalog)
      } else if ('alreadyPending' in res) {
        toast.info(`Ya hay una solicitud pendiente para "${limpio}".`)
      } else {
        toast.success(
          `Solicitud enviada al admin. Te avisamos cuando aprueben "${limpio}".`
        )
      }
      setValue('')
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline"
      >
        {role === 'admin' || role === 'super'
          ? '+ Crear color nuevo'
          : '+ Solicitar color al admin'}
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-input bg-zinc-50/40 p-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nombre del color"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') {
            setOpen(false)
            setValue('')
          }
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? '...' : 'Enviar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setValue('')
          }}
          className="flex-1 rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
        >
          <X className="inline size-3" /> Cancelar
        </button>
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
