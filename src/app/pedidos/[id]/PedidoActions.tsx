'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import { UBICACIONES } from '@/lib/ubicaciones'
import {
  cancelarPedido,
  confirmarEgresoPedido,
  entregarPedido,
} from '../actions'

type Mode =
  | 'view'
  | 'confirmar-salida'
  | 'caer-pedido'
  | 'confirmar-cancelar'
  | 'confirmar-entregar'

const MOTIVOS_CAIDA = [
  { value: 'cliente_cancelo', label: 'Cliente cancelo' },
  { value: 'precio', label: 'Precio' },
  { value: 'otro_proveedor', label: 'Se fue con otro proveedor' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro' },
]

const UBICACION_OPTIONS = UBICACIONES.map((u) => ({ value: u, label: u }))

export default function PedidoActions({
  pedidoId,
  estado,
  role,
}: {
  pedidoId: string
  estado: string
  role: 'ventas' | 'admin'
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('view')
  const [pending, startTransition] = useTransition()

  const [salidaComentario, setSalidaComentario] = useState('')
  const [remitoSalida, setRemitoSalida] = useState('')
  const [motivoCaida, setMotivoCaida] = useState('')
  const [comentarioCaida, setComentarioCaida] = useState('')
  const [ubicacionReasignacion, setUbicacionReasignacion] =
    useState('A ordenar')

  const esVentasOAdmin = role === 'ventas' || role === 'admin'
  const puedeConfirmarSalida = esVentasOAdmin && estado === 'lista'
  const puedeCaerPedido = esVentasOAdmin && estado === 'lista'
  const puedeCancelar =
    esVentasOAdmin &&
    (estado === 'pendiente' ||
      estado === 'en_preparacion' ||
      estado === 'confirmada_egreso')
  const puedeEntregar = role === 'admin' && estado === 'confirmada_egreso'

  if (
    !puedeCancelar &&
    !puedeEntregar &&
    !puedeConfirmarSalida &&
    !puedeCaerPedido
  ) {
    return null
  }

  function resetForms() {
    setMode('view')
    setSalidaComentario('')
    setRemitoSalida('')
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
      toast.success('Salida confirmada.')
      resetForms()
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

  function handleEntregar() {
    startTransition(async () => {
      const res = await entregarPedido(pedidoId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Pedido marcado como entregado.')
      resetForms()
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      {estado === 'lista' && mode === 'view' && (
        <p className="text-xs text-muted-foreground">
          El picking termino. Confirmar salida registra el momento en que la
          mercaderia salio de fabrica. Si se cae, los rollos vuelven a stock en
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
            Confirmar salida
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
        {puedeEntregar && mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('confirmar-entregar')}
            className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Marcar como entregado
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
            Confirmas que la mercaderia efectivamente salio de fabrica. Se
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
            confirmLabel={pending ? 'Confirmando...' : 'Si, confirmar salida'}
            onConfirm={handleConfirmarSalida}
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
                options={UBICACION_OPTIONS}
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

      {mode === 'confirmar-entregar' && (
        <div className="rounded-md bg-zinc-50 border p-3 space-y-2">
          <p className="text-sm">
            Marcamos el pedido como entregado al cliente. Los rollos pasan a
            estado &quot;Entregado&quot; y dejan de figurar en stock.
          </p>
          <ActionsFooter
            pending={pending}
            onCancel={resetForms}
            confirmLabel={pending ? 'Marcando...' : 'Si, marcar entregada'}
            onConfirm={handleEntregar}
            tone="success"
          />
        </div>
      )}
    </div>
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
