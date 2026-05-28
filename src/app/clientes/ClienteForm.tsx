'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearCliente, editarCliente, type ClienteInput } from './actions'

export type VendedorOption = {
  id: string
  nombre: string
}

export default function ClienteForm({
  cliente,
  vendedores = [],
  onDone,
}: {
  cliente?: {
    id: string
    nombre: string
    cuit_cuil: string | null
    contacto: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
    condicion_pago: string | null
    categoria_precio: string | null
    estado_cliente: string | null
    vendedor_asignado: string | null
    notas: string | null
  }
  vendedores?: VendedorOption[]
  onDone?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [cuitCuil, setCuitCuil] = useState(cliente?.cuit_cuil ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [condicionPago, setCondicionPago] = useState(
    cliente?.condicion_pago ?? ''
  )
  const [categoriaPrecio, setCategoriaPrecio] = useState(
    cliente?.categoria_precio ?? ''
  )
  const [estadoCliente, setEstadoCliente] = useState(
    cliente?.estado_cliente ?? 'activo'
  )
  const [vendedorAsignado, setVendedorAsignado] = useState(
    cliente?.vendedor_asignado ?? ''
  )
  const [notas, setNotas] = useState(cliente?.notas ?? '')
  const vendedorOptions = vendedores.some((v) => v.nombre === vendedorAsignado)
    ? vendedores
    : vendedorAsignado
      ? [...vendedores, { id: vendedorAsignado, nombre: vendedorAsignado }]
      : vendedores

  function resetForm() {
    setNombre('')
    setCuitCuil('')
    setContacto('')
    setEmail('')
    setTelefono('')
    setDireccion('')
    setCondicionPago('')
    setCategoriaPrecio('')
    setEstadoCliente('activo')
    setVendedorAsignado('')
    setNotas('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: ClienteInput = {
      nombre,
      cuit_cuil: cuitCuil,
      contacto,
      email,
      telefono,
      direccion,
      condicion_pago: condicionPago,
      categoria_precio: categoriaPrecio,
      estado_cliente: estadoCliente,
      vendedor_asignado: vendedorAsignado,
      notas,
    }
    startTransition(async () => {
      const res = cliente
        ? await editarCliente(cliente.id, input)
        : await crearCliente(input)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(cliente ? 'Cliente actualizado.' : 'Cliente creado.')
      if (!cliente) resetForm()
      router.refresh()
      onDone?.()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej. Confecciones Perez"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <Field label="CUIT/CUIL">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cuitCuil}
            onChange={(e) => setCuitCuil(e.target.value.replace(/\D/g, ''))}
            placeholder="20123456789"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Estado del cliente">
          <select
            value={estadoCliente}
            onChange={(e) => setEstadoCliente(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="activo">Activo</option>
            <option value="potencial">Potencial</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </Field>

        <Field label="Contacto">
          <input
            type="text"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Nombre del referente"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@empresa.com"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Telefono">
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="011..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Dirección">
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle, numero, ciudad"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Condición de pago">
          <select
            value={condicionPago}
            onChange={(e) => setCondicionPago(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Sin definir</option>
            <option value="contado">Contado</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
            <option value="30_dias">30 días</option>
            <option value="60_dias">60 días</option>
            <option value="90_dias">90 días</option>
          </select>
        </Field>

        <Field label="Categoría de precio">
          <select
            value={categoriaPrecio}
            onChange={(e) => setCategoriaPrecio(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Sin categoría</option>
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
            <option value="precio_especial">Precio especial</option>
          </select>
        </Field>

        <Field label="Vendedor asignado">
          <select
            value={vendedorAsignado}
            onChange={(e) => setVendedorAsignado(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Sin asignar</option>
            {vendedorOptions.map((v) => (
              <option key={v.id} value={v.nombre}>
                {v.nombre}
              </option>
            ))}
          </select>
        </Field>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalles, preferencias, condiciones especiales, etc."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !nombre.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {pending
            ? 'Guardando...'
            : cliente
              ? 'Guardar cambios'
              : 'Crear cliente'}
        </button>
      </div>
    </form>
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
