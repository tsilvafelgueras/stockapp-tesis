/**
 * Tipos para el sistema de configuración de extracción por tintorería.
 *
 * Cada tintorería con formato específico de planilla tiene un archivo
 * propio en este directorio que exporta una `TintoreriaConfig`.
 * El registry central (_registry.ts) los expone via `getConfig(key)`.
 */

export type TintoreriaConfig = {
  /**
   * Identificador único, matcheable con `tintorerias.extraction_config_key` en DB.
   * Convención: kebab-case, sin espacios. Ej: "muter-textil", "tex-color-srl".
   */
  key: string

  /** Nombre legible para mostrar en logs / debug. */
  nombre: string

  /** Qué tipo de planilla maneja esta config. Útil para devs futuros. */
  descripcion: string

  /**
   * Instrucciones específicas de extracción que se agregan al prompt base.
   * Acá va la info sobre el layout particular (bloques de columnas, posición
   * del header, formato de fecha específico, etc.).
   */
  promptInstructions: string
}
