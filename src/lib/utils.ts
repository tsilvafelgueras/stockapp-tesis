import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatArticulos(nombres: (string | null | undefined)[]): string {
  const unicos = Array.from(
    new Set(nombres.filter((n): n is string => Boolean(n && n.trim())))
  ).sort((a, b) => a.localeCompare(b, 'es'))

  if (unicos.length === 0) return '—'
  if (unicos.length <= 2) return unicos.join(', ')
  return `${unicos.slice(0, 2).join(', ')} y ${unicos.length - 2} más`
}
