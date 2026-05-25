import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type {
  IngresoExtraido,
  ExtraccionResult,
} from './extraerPlanilla'

const MODELO = 'gemini-2.5-flash'

// ── Prompt base ────────────────────────────────────────────
//
// Es la parte fija del prompt: rol del asistente + formato de salida.
// Las instrucciones específicas de cada tintorería (campo `extraction_prompt`
// en la tabla `tintorerias`, editado por el superadmin) se concatenan después
// en buildPrompt(). Si no hay prompt custom, usamos DEFAULT_INSTRUCTIONS.

const PROMPT_BASE = `
Sos un asistente experto en procesar planillas de remitos de tintorerías textiles argentinas.

Te paso una imagen o PDF de una planilla. Extraé TODOS los datos en formato JSON estructurado, según el schema dado.

Devolvé el JSON directamente. No agregues explicaciones ni texto adicional fuera del JSON.
`.trim()

const DEFAULT_INSTRUCTIONS = `
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
`.trim()

function buildPrompt(customPrompt: string | null): string {
  const instrucciones = customPrompt?.trim() || DEFAULT_INSTRUCTIONS
  return `${PROMPT_BASE}\n\n${instrucciones}`
}

// ── Schema (Gemini responseSchema) ──────────────────────────
//
// Cada campo de la planilla se envuelve en `{ value, confidence }` para
// que la IA reporte su confianza por celda.

function fieldString(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      value: { type: Type.STRING, nullable: true },
      confidence: { type: Type.NUMBER },
    },
    required: ['value', 'confidence'],
  }
}

function fieldNumber(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      value: { type: Type.NUMBER, nullable: true },
      confidence: { type: Type.NUMBER },
    },
    required: ['value', 'confidence'],
  }
}

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    numero_remito: fieldString(),
    fecha: fieldString(),
    color: fieldString(),
    ot: fieldString(),
    rem_tejeduria: fieldString(),
    referencia: fieldString(),
    total_rollos_declarado: fieldNumber(),
    total_kilos_declarado: fieldNumber(),
    rollos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          numero_pieza: fieldString(),
          kilos: fieldNumber(),
          metros: fieldNumber(),
          ratio: fieldNumber(),
          gramaje_planilla: fieldNumber(),
          articulo: fieldString(),
        },
        required: [
          'numero_pieza',
          'kilos',
          'metros',
          'ratio',
          'gramaje_planilla',
          'articulo',
        ],
      },
    },
  },
  required: [
    'numero_remito',
    'fecha',
    'color',
    'ot',
    'rem_tejeduria',
    'referencia',
    'total_rollos_declarado',
    'total_kilos_declarado',
    'rollos',
  ],
}

// ── Implementación ──────────────────────────────────────────

export async function extraerConGemini(
  fileBuffer: Buffer,
  mimeType: string,
  customPrompt: string | null
): Promise<ExtraccionResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: 'Falta GEMINI_API_KEY en las variables de entorno',
      codigo: 'NO_API_KEY',
    }
  }

  const prompt = buildPrompt(customPrompt)

  const TIMEOUT_MS = 45_000

  let response
  try {
    const ai = new GoogleGenAI({ apiKey })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('La IA tardó demasiado. Intentá de nuevo o cargá manualmente.')),
        TIMEOUT_MS
      )
    )
    response = await Promise.race([
      ai.models.generateContent({
        model: MODELO,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
      timeout,
    ])
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    return {
      ok: false,
      error: msg,
      codigo: 'GEMINI_ERROR',
    }
  }

  const text = response.text
  if (!text) {
    return {
      ok: false,
      error: 'La IA no devolvió contenido',
      codigo: 'GEMINI_ERROR',
    }
  }

  try {
    const parsed = JSON.parse(text) as IngresoExtraido
    if (!parsed.rollos || parsed.rollos.length === 0) {
      return {
        ok: false,
        error:
          'La imagen no parece ser una planilla de tintorería válida. La IA no encontró ningún rollo. Verificá que subiste la foto correcta.',
        codigo: 'FORMATO_INVALIDO',
      }
    }
    return { ok: true, data: parsed }
  } catch (e) {
    return {
      ok: false,
      error: `JSON inválido en respuesta de IA: ${(e as Error).message}`,
      codigo: 'JSON_INVALID',
    }
  }
}
