/**
 * Registry central de configs por tintorería.
 *
 * Para agregar una tintorería nueva con formato específico:
 *   1. Crear un archivo `./{key}.ts` que exporte una `TintoreriaConfig`
 *   2. Agregarlo al objeto CONFIGS abajo
 *   3. Aplicar SQL: UPDATE tintorerias SET extraction_config_key = '{key}' WHERE id = '...'
 *
 * Nada más. El admin de la empresa-cliente NO ve esto, lo manejamos los devs.
 */

import { DEFAULT_CONFIG } from './_default'
import { MUTER_TEXTIL_CONFIG } from './muter-textil'
import type { TintoreriaConfig } from './_types'

/**
 * Mapa de configs disponibles. Agregar acá cuando se sume una tintorería nueva.
 */
const CONFIGS: Record<string, TintoreriaConfig> = {
  [MUTER_TEXTIL_CONFIG.key]: MUTER_TEXTIL_CONFIG,
}

/**
 * Devuelve la config asociada a una key, o el default si no existe.
 *
 * @param key Valor de `tintorerias.extraction_config_key`. Puede ser null.
 */
export function getConfig(key: string | null): TintoreriaConfig {
  if (!key) return DEFAULT_CONFIG
  return CONFIGS[key] ?? DEFAULT_CONFIG
}

/** Lista de keys disponibles. Útil para debug o futuros admin tools. */
export function listConfigKeys(): string[] {
  return Object.keys(CONFIGS)
}
