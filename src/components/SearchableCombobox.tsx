'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SearchableOption = {
  value: string
  label: string
  description?: string
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Sin resultados',
  disabled = false,
  allowClear = true,
  className = '',
  autocomplete = false,
}: {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  allowClear?: boolean
  className?: string
  /** Modo autocomplete: el campo principal es un <input> editable.
   *  El usuario escribe directamente y el dropdown filtra en tiempo real.
   *  Útil cuando la lista es larga (ej: 100+ colores). */
  autocomplete?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find((o) => o.value === value) ?? null

  // En modo autocomplete el input muestra el label seleccionado cuando está
  // cerrado; mientras el dropdown está abierto muestra lo que el usuario tipea.
  const [inputText, setInputText] = useState(selected?.label ?? '')
  useEffect(() => {
    if (!open) {
      setInputText(selected?.label ?? '')
    }
  }, [value, open, options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q)
    )
  }, [options, query])

  function close() {
    setOpen(false)
    setQuery('')
  }

  // Cierre por "click afuera" (pointerdown a nivel documento). Reemplaza al
  // onBlur + flag de touch: así las opciones se seleccionan con un onClick
  // simple y la lista se puede SCROLLEAR con el dedo en mobile (no hay
  // preventDefault en pointerdown que bloquee el scroll nativo).
  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  const dropdownList = (
    <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
      {!autocomplete && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto py-1 [touch-action:pan-y] [overscroll-behavior:contain]">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          filtered.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                data-no-ripple
                onClick={() => {
                  onChange(option.value)
                  close()
                }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                  active ? 'bg-accent/50' : ''
                }`}
              >
                <Check
                  className={`mt-0.5 size-4 shrink-0 ${
                    active ? 'text-action' : 'text-transparent'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  if (autocomplete) {
    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <div className="flex min-h-10 items-center rounded-md border bg-white text-sm focus-within:ring-2 focus-within:ring-ring">
          <input
            ref={inputRef}
            type="text"
            value={open ? inputText : (selected?.label ?? '')}
            onChange={(e) => {
              setInputText(e.target.value)
              setQuery(e.target.value)
              if (!open) setOpen(true)
            }}
            onFocus={() => {
              setInputText('')
              setQuery('')
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'Enter' && filtered.length === 1) {
                onChange(filtered[0].value)
                close()
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {allowClear && value && !disabled ? (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                onChange('')
                close()
              }}
              className="mr-1 rounded p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
              aria-label="Limpiar seleccion"
            >
              <X className="size-4" />
            </button>
          ) : (
            <ChevronDown className="mr-2 size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        {open && dropdownList}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex min-h-10 items-center rounded-md border bg-white text-sm focus-within:ring-2 focus-within:ring-ring">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={
              selected
                ? 'truncate text-foreground'
                : 'truncate text-muted-foreground'
            }
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              close()
            }}
            className="mr-1 rounded p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
            aria-label="Limpiar seleccion"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && dropdownList}
    </div>
  )
}
