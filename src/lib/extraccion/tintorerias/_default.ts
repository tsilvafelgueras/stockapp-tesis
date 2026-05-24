/**
 * Config DEFAULT para tintorerías sin formato específico.
 *
 * Se usa cuando una tintorería tiene `extraction_config_key = NULL` en la DB,
 * o cuando el key apunta a un archivo que no existe en este registry.
 *
 * El prompt es genérico: describe los campos esperados pero NO incluye
 * suposiciones sobre layout específico (bloques de columnas, posición del
 * header, formato de fecha, etc.). Esa info se agrega en configs por
 * tintorería específica.
 */

import type { TintoreriaConfig } from './_types'

export const DEFAULT_CONFIG: TintoreriaConfig = {
  key: '_default',
  nombre: 'Default (genérico)',
  descripcion:
    'Prompt genérico. Funciona razonable para cualquier planilla pero con menos precisión que un config específico de tintorería.',
  promptInstructions: `
La planilla es un remito de una tintorería textil argentina. Extraé los datos en formato JSON.

# HEADER (datos del lote/despacho, uno solo)

- numero_remito: número de la planilla. Aparece como "DESPACHO N°", "REMITO N°", "N° DE REMITO" o similar. Suele estar en una esquina, a veces con código de barras al lado.
- fecha: en ISO 'YYYY-MM-DD'. Si la planilla la trae como 'DD/MM/YY' o 'DD/MM/YYYY', convertí. Si son 2 dígitos del año, asumí 20YY.
- color: color del lote (ej "BLANCO", "NEGRO", "AZUL FRANCIA"). UN SOLO COLOR para toda la planilla.
- ot: número de orden de trabajo de la tintorería ("OT", "O.T.", "ORDEN").
- rem_tejeduria: remito de tejeduría ("REM. TEJ.", "REM TEJEDURIA"), del proveedor de tela cruda.
- referencia: código interno (ej "SBI"), suele ser 2-5 letras.
- total_rollos_declarado: número total de rollos.
- total_kilos_declarado: kilos despachados (NO ingresados).

# POR CADA ROLLO

- numero_pieza: identificador del rollo. String, conservar ceros a la izquierda.
- kilos: peso en kg (decimal, punto NO coma).
- metros: largo en metros (decimal).
- ratio: rendimiento m/kg (decimal). A veces "Ratio", "Rdto", "Rto".
- gramaje_planilla: g/m² (peso por m²). Suele aparecer como "Pm2", "Gramaje", "g/m²".
- articulo: nombre del artículo/tela del rollo (ej "Algodón Pima", "Modal", "Lino"). Algunas planillas traen un único artículo en el header (en ese caso, copialo en todos los rollos). Otras traen una columna "Artículo" o "Tela" por rollo. Si no aparece en ninguna parte, devolvé value: null y confidence: 0.

# CONFIANZA

Cada campo tiene un campo "confidence" (0.0-1.0):
- 1.0 = clarísimo, sin ambigüedad
- 0.85-0.95 = legible con riesgo bajo (0/O, 5/S, 1/I confundibles)
- 0.5-0.85 = legible con dudas (mancha, decimal poco claro)
- 0.0-0.5 = casi ilegible, adiviné por contexto

Si un campo NO aparece, devolvé value: null y confidence: 0.

Devolvé solo el JSON. No agregues texto adicional.
`.trim(),
}
