'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearUbicacion } from './actions'
import UbicacionRow from './UbicacionRow'
import { TIPOS, Field } from './shared'

export type UbicacionAdminRow = {
  id: string
  codigo: string
  descripcion: string | null
  tipo: string
  capacidad_rollos: number | null
  capacidad_kg: number | null
  orden: number
  activa: boolean
  rollos: number
  kilos: number
}

const EMPTY_FORM = {
  codigo: '',
  descripcion: '',
  tipo: 'general',
  capacidadRollos: '',
  capacidadKg: '',
  orden: '',
  activa: true,
}

export default function UbicacionesManager({
  ubicaciones,
}: {
  ubicaciones: UbicacionAdminRow[]
}) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [pending, startTransition] = useTransition()

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function submit() {
    startTransition(async () => {
      const res = await crearUbicacion(form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Ubicacion creada.')
      setForm(EMPTY_FORM)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Nueva ubicación</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Codigo *">
            <input
              value={form.codigo}
              onChange={(e) => setField('codigo', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Ej. A1"
            />
          </Field>
          <Field label="Tipo">
            <select
              value={form.tipo}
              onChange={(e) => setField('tipo', e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacidad rollos">
            <input
              value={form.capacidadRollos}
              onChange={(e) => setField('capacidadRollos', e.target.value)}
              inputMode="numeric"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Capacidad kg">
            <input
              value={form.capacidadKg}
              onChange={(e) => setField('capacidadKg', e.target.value)}
              inputMode="decimal"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <input
                value={form.descripcion}
                onChange={(e) => setField('descripcion', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Qué contiene o para qué se usa"
              />
            </Field>
          </div>
          <Field label="Orden">
            <input
              value={form.orden}
              onChange={(e) => setField('orden', e.target.value)}
              inputMode="numeric"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setField('activa', e.target.checked)}
            />
            Activa
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !form.codigo.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Ubicaciones ({ubicaciones.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 text-right font-medium">Ocupación</th>
                <th className="px-4 py-2 text-right font-medium">Kg</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {ubicaciones.map((u) => (
                <UbicacionRow key={u.id} ubicacion={u} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
