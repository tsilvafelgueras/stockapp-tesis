'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import {
  ubicacionesToOptions,
  type UbicacionOption,
} from '@/lib/ubicaciones'
import {
  actualizarPedidoRemito,
  cancelarPedido,
  confirmarEgresoPedido,
} from '../actions'

type Mode =
  | 'view'
  | 'confirmar-salida'
  | 'editar-remito'
  | 'caer-pedido'
  | 'confirmar-cancelar'

const MOTIVOS_CAIDA = [
  { value: 'cliente_cancelo', label: 'Cliente cancelo' },
  { value: 'precio', label: 'Precio' },
  { value: 'otro_proveedor', label: 'Se fue con otro proveedor' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro' },
]

export default function PedidoActions({
  pedidoId,
  estado,
  role,
  ubicaciones,
  numeroRemitoExterno,
}: {
  pedidoId: string
  estado: string
  role: 'ventas' | 'admin' | 'operario'
  ubicaciones: UbicacionOption[]
  numeroRemitoExterno: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('view')
  const [pending, startTransition] = useTransition()

  const [salidaComentario, setSalidaComentario] = useState('')
  const [remitoSalida, setRemitoSalida] = useState('')
  const [remitoExterno, setRemitoExterno] = useState(numeroRemitoExterno ?? '')
  const [motivoCaida, setMotivoCaida] = useState('')
  const [comentarioCaida, setComentarioCaida] = useState('')
  const [ubicacionReasignacion, setUbicacionReasignacion] =
    useState('A ordenar')
  const ubicacionOptions = ubicacionesToOptions(ubicaciones)

  const esVentasOAdmin = role === 'ventas' || role === 'admin'
  const puedeConfirmarSalida =
    (role === 'operario' || role === 'admin') && estado === 'lista'
  const puedeEditarRemito =
    esVentasOAdmin &&
    estado !== 'cancelada' &&
    estado !== 'confirmada_egreso' &&
    estado !== 'entregada'
  const puedeCaerPedido = false
  const puedeCancelar =
    esVentasOAdmin &&
    (estado === 'pendiente' ||
      estado === 'en_preparacion' ||
      estado === 'lista' ||
      estado === 'confirmada_egreso')

  if (
    !puedeCancelar &&
    !puedeConfirmarSalida &&
    !puedeEditarRemito &&
    !puedeCaerPedido
  ) {
    return null
  }

  function resetForms() {
    setMode('view')
    setSalidaComentario('')
    setRemitoSalida('')
    setRemitoExterno(numeroRemitoExterno ?? '')
    setMotivoCaida('')
    setComentarioCaida('')
    setUbicacionReasignacion('A ordenar')
  }

  function handleConfirmarSalida() {
    startTransition(async () => {
      const res = await confirmarEgresoPedido(
        pedidoId,
        salidaComentario,
        remitoSalida
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Egreso confirmado.')
      resetForms()
      router.refresh()
    })
  }

  function handleEditarRemito() {
    startTransition(async () => {
      const res = await actualizarPedidoRemito(pedidoId, remitoExterno)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Remito actualizado.')
      setMode('view')
      router.refresh()
    })
  }

  function handleCancelarPedido() {
    startTransition(async () => {
      const res = await cancelarPedido(
        pedidoId,
        motivoCaida,
        comentarioCaida,
        ubicacionReasignacion
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Pedido cancelado. Los rollos volvieron a stock.')
      resetForms()
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      {estado === 'lista' && mode === 'view' && (
        <p className="text-xs text-muted-foreground">
          El picking termino. Confirmar egreso registra el momento en que la
          mercaderia salio de deposito. Si se cancela, los rollos vuelven a stock en
          la ubicacion indicada.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {puedeConfirmarSalida && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-salida')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Confirmar egreso
          </button>
        )}
        {puedeEditarRemito && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('editar-remito')}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            Editar remito
          </button>
        )}
        {puedeCaerPedido && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('caer-pedido')}
            className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Caer pedido
          </button>
        )}
        {puedeCancelar && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-cancelar')}
            className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Cancelar pedido
          </button>
        )}
      </div>

      {mode === 'confirmar-salida' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-3">
          <p className="text-sm">
            Confirmas que la mercaderia efectivamente salio de deposito. Se
            guarda fecha, usuario, remito y comentario.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nro remito de salida">
              <input
                type="text"
                value={remitoSalida}
                onChange={(e) => setRemitoSalida(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Comentario">
              <textarea
                value={salidaComentario}
                onChange={(e) => setSalidaComentario(e.target.value)}
                rows={2}
                placeholder="Opcional"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <ActionsFooter
            pending={pending}
            onCancel={resetForms}
            confirmLabel={pending ? 'Confirmando...' : 'Si, confirmar egreso'}
            onConfirm={handleConfirmarSalida}
            tone="success"
          />
        </div>
      )}

      {mode === 'editar-remito' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-3">
          <p className="text-sm">
            Podés cargar o corregir el número de remito externo mientras el
            pedido no tenga egreso confirmado.
          </p>
          <Field label="Nro remito externo">
            <input
              type="text"
              value={remitoExterno}
              onChange={(e) => setRemitoExterno(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <ActionsFooter
            pending={pending}
            onCancel={resetForms}
            confirmLabel={pending ? 'Guardando...' : 'Guardar remito'}
            onConfirm={handleEditarRemito}
            tone="success"
          />
        </div>
      )}

      {(mode === 'caer-pedido' || mode === 'confirmar-cancelar') && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-3">
          <p className="text-sm">
            El pedido queda cancelado y los rollos se liberan para volver a
            venderse.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Motivo de caida *">
              <select
                value={motivoCaida}
                onChange={(e) => setMotivoCaida(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar motivo...</option>
                {MOTIVOS_CAIDA.map((motivo) => (
                  <option key={motivo.value} value={motivo.value}>
                    {motivo.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ubicacion para los rollos">
              <SearchableCombobox
                value={ubicacionReasignacion}
                onChange={setUbicacionReasignacion}
                options={withCurrentUbicacion(
                  ubicacionReasignacion,
                  ubicacionOptions
                )}
                placeholder="Seleccionar ubicacion..."
                allowClear={false}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Comentario">
                <textarea
                  value={comentarioCaida}
                  onChange={(e) => setComentarioCaida(e.target.value)}
                  rows={2}
                  placeholder="Detalle opcional"
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>
          <ActionsFooter
            pending={pending}
            disabled={!motivoCaida}
            onCancel={resetForms}
            confirmLabel={pending ? 'Liberando...' : 'Si, cancelar pedido'}
            onConfirm={handleCancelarPedido}
            tone="destructive"
          />
        </div>
      )}

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

function ActionsFooter({
  pending,
  disabled = false,
  onCancel,
  onConfirm,
  confirmLabel,
  tone,
}: {
  pending: boolean
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  tone: 'success' | 'destructive'
}) {
  return (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
      >
        Volver
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending || disabled}
        className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          tone === 'success'
            ? 'bg-success text-success-foreground'
            : 'bg-destructive text-white'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
