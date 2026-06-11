'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { actualizarUbicacion, toggleUbicacion } from './actions'
import type { UbicacionAdminRow } from './UbicacionesManager'
import { TIPOS, OcupacionValue, tipoLabel, Field } from './shared'

type Mode = 'view' | 'edit'

export default function UbicacionRow({
  ubicacion,
}: {
  ubicacion: UbicacionAdminRow
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('view')
  const [form, setForm] = useState({
    codigo: ubicacion.codigo,
    descripcion: ubicacion.descripcion ?? '',
    tipo: ubicacion.tipo,
    capacidadRollos: ubicacion.capacidad_rollos?.toString() ?? '',
    capacidadKg: ubicacion.capacidad_kg?.toString() ?? '',
    orden: ubicacion.orden.toString(),
    activa: ubicacion.activa,
  })
  const [pending, startTransition] = useTransition()

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm({
      codigo: ubicacion.codigo,
      descripcion: ubicacion.descripcion ?? '',
      tipo: ubicacion.tipo,
      capacidadRollos: ubicacion.capacidad_rollos?.toString() ?? '',
      capacidadKg: ubicacion.capacidad_kg?.toString() ?? '',
      orden: ubicacion.orden.toString(),
      activa: ubicacion.activa,
    })
  }

  function guardar() {
    startTransition(async () => {
      const res = await actualizarUbicacion(ubicacion.id, form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Ubicacion actualizada.')
      setMode('view')
      router.refresh()
    })
  }

  function toggle() {
    startTransition(async () => {
      const res = await toggleUbicacion(ubicacion.id, !ubicacion.activa)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        ubicacion.activa ? 'Ubicacion desactivada.' : 'Ubicacion activada.'
      )
      router.refresh()
    })
  }

  if (mode === 'edit') {
    return (
      <tr className="border-b last:border-0 bg-accent/40">
        <td colSpan={7} className="px-4 py-4">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Codigo *">
                <input
                  value={form.codigo}
                  onChange={(e) => setField('codigo', e.target.value)}
                  autoFocus
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                  placeholder="Ej. A1"
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setField('tipo', e.target.value)}
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
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
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </Field>
              <Field label="Capacidad kg">
                <input
                  value={form.capacidadKg}
                  onChange={(e) => setField('capacidadKg', e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descripcion">
                  <input
                    value={form.descripcion}
                    onChange={(e) => setField('descripcion', e.target.value)}
                    className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                    placeholder="Que contiene o para que se usa"
                  />
                </Field>
              </div>
              <Field label="Orden">
                <input
                  value={form.orden}
                  onChange={(e) => setField('orden', e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
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
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setMode('view')
                }}
                disabled={pending}
                className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={pending || !form.codigo.trim()}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-2 font-mono font-medium">{ubicacion.codigo}</td>
      <td className="px-4 py-2 text-muted-foreground">
        {ubicacion.descripcion ?? '-'}
      </td>
      <td className="px-4 py-2">{tipoLabel(ubicacion.tipo)}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        <OcupacionValue
          current={ubicacion.rollos}
          capacity={ubicacion.capacidad_rollos}
          unit="rollos"
        />
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        <OcupacionValue
          current={ubicacion.kilos}
          capacity={ubicacion.capacidad_kg}
          unit="kg"
          decimals={2}
        />
      </td>
      <td className="px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            ubicacion.activa
              ? 'bg-success/15 text-success'
              : 'bg-zinc-100 text-muted-foreground'
          }`}
        >
          {ubicacion.activa ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            disabled={pending}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            {ubicacion.activa ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </td>
    </tr>
  )
}
