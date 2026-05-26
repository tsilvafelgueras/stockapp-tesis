'use server'

export type DecodificarQRResult =
  | { ok: true; texto: string }
  | {
      ok: false
      error: string
      codigo: 'NO_DETECTADO' | 'API_ERROR' | 'IMAGEN_INVALIDA'
    }

const MAX_BYTES = 1024 * 1024
const API_URL = 'https://api.qrserver.com/v1/read-qr-code/'
const TIMEOUT_MS = 10_000

type GoqrSymbol = { seq: number; data: string | null; error: string | null }
type GoqrResponse = Array<{ type: string; symbol: GoqrSymbol[] }>

export async function decodificarQRConApi(
  formData: FormData
): Promise<DecodificarQRResult> {
  const file = formData.get('file')

  if (!(file instanceof Blob) || file.size === 0) {
    return {
      ok: false,
      error: 'No se pudo leer la imagen para enviarla al servidor.',
      codigo: 'IMAGEN_INVALIDA',
    }
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: 'La imagen es demasiado grande para procesar.',
      codigo: 'IMAGEN_INVALIDA',
    }
  }

  const upstream = new FormData()
  upstream.append('file', file, 'frame.jpg')
  upstream.append('outputformat', 'json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: upstream,
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `El servidor de lectura devolvió un error (${response.status}).`,
        codigo: 'API_ERROR',
      }
    }

    const json = (await response.json()) as GoqrResponse
    const symbol = json?.[0]?.symbol?.[0]

    if (symbol?.data) {
      return { ok: true, texto: symbol.data }
    }

    return {
      ok: false,
      error:
        'El servidor tampoco pudo leer el QR. Probá acercando la cámara o ingresalo a mano.',
      codigo: 'NO_DETECTADO',
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      error: aborted
        ? 'El servidor tardó demasiado en responder. Probá de nuevo.'
        : 'No pudimos comunicarnos con el servidor de lectura.',
      codigo: 'API_ERROR',
    }
  } finally {
    clearTimeout(timer)
  }
}
