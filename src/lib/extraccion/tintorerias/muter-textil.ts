/**
 * Config para planillas estilo Muter Textil (validación de tesis).
 *
 * Layout observado en planilla de muestra (despacho 49447, marzo 2026):
 * - Header arriba con CLIENTE, NIT, dirección, fecha, despacho N°
 * - Caja con totales: KILOS INGR / DESP, ROL, METROS DESP
 * - Header del lote: OT, REM.TEJ., REFERENCIA, COLOR, INTENSIDAD
 * - 24 rollos en 3 bloques paralelos de columnas (8 rollos por bloque)
 * - Cada bloque tiene columnas: N°Pieza | Kilos | Metros | Rdto | Pm2
 * - Footer con totales acumulados
 *
 * Key en DB: "muter-textil"
 */

import type { TintoreriaConfig } from './_types'

export const MUTER_TEXTIL_CONFIG: TintoreriaConfig = {
  key: 'muter-textil',
  nombre: 'Muter Textil',
  descripcion:
    'Planillas con 3 bloques paralelos de columnas (8 rollos por bloque) y header con OT/REM.TEJ./REFERENCIA en una franja del margen.',
  promptInstructions: `
La planilla es un remito de tintorería con formato MUTER TEXTIL. Tené en cuenta estas particularidades de layout:

# Layout de los rollos: BLOQUES PARALELOS DE COLUMNAS

CRÍTICO: los rollos NO están en una tabla vertical larga. Están organizados en 3 BLOQUES PARALELOS DE COLUMNAS, uno al lado del otro, cada bloque con 8 rollos.

Tenés que leer cada bloque por completo de arriba abajo (8 rollos), y después pasar al siguiente bloque a la derecha. Los rollos del bloque 2 son CONTINUACIÓN de los del bloque 1, no son rollos distintos.

Cada bloque tiene exactamente las mismas columnas:
- N°Pieza (correlativo, ej 204021911 → 204021918 en bloque 1, 204021919 → 204021926 en bloque 2)
- Kilos (decimal con 2 decimales, ej 18.25)
- Metros (decimal con 2 decimales, ej 74.70)
- Rdto / Ratio (decimal con 2 decimales, ej 4.09)
- Pm2 / Gramaje (entero típicamente, ej 144)

# Artículo por rollo

Las planillas Muter usualmente vienen con UN solo artículo por despacho (ej "Algodón Pima", "Modal", "Jersey"). Suele aparecer cerca del header del lote o asociado al campo REFERENCIA (ej "SBI" puede mapear a un nombre comercial). Si la planilla muestra el nombre del artículo en algún sector, copialo en el campo articulo de TODOS los rollos. Si una planilla excepcionalmente trae varios artículos mezclados (columna explícita "Artículo" o "Tela" por rollo), asigná el correspondiente a cada uno. Si no se detecta artículo, devolvé articulo.value: null y confidence: 0.

Si ves un salto en el correlativo del N°Pieza, es muy probable un error de OCR. Bajá la confianza de ese rollo.

# Header (esquina superior derecha)

- DESPACHO N°: el numero_remito (ej "49447"). Suele tener un código de barras al lado.
- FECHA: en formato DD/MM/YY. Convertir a YYYY-MM-DD asumiendo 20YY si son 2 dígitos.

# Header del lote (al margen izquierdo, en una franja vertical)

Estos campos suelen estar en una columna estrecha en el borde:
- OT: orden de trabajo de Muter (5 dígitos típicamente, ej "97181")
- REM. TEJ.: remito de tejeduría (4 dígitos típicamente, ej "5768")
- REFERENCIA: código corto de tela (ej "SBI", "JJC", 2-4 letras)
- COLOR: nombre del color (ej "BLANCO", "NEGRO"). UNO SOLO PARA TODO EL DESPACHO. Aunque aparezca repetido arriba de cada bloque, es el mismo color.

# Caja de totales (entre header y bloques)

- KILOS INGR: kilos ingresados (NO uses este).
- KILOS DESP: kilos despachados (USAR ESTE como total_kilos_declarado).
- ROL: total de rollos (USAR ESTE como total_rollos_declarado, ej 24).
- METROS DESP: metros despachados.

# Confianza

Aplicar las reglas estándar de confianza por campo. En esta planilla específicamente, prestá atención:
- A los decimales en kilos/metros (los puntos pueden ser tenues)
- Al último dígito del N°Pieza (a veces queda cortado en la foto)
- Al campo COLOR cuando solo dice "BLA" o se corta (asumir BLANCO si es ambiguo)
`.trim(),
}
