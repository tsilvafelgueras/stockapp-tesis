import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtraccionResult } from './extraerPlanilla'
const mocks = vi.hoisted(() => ({ process: vi.fn(), constructor: vi.fn() }))
vi.mock('@mistralai/mistralai', () => ({
  Mistral: class {
    constructor(options: unknown) { mocks.constructor(options) }
    ocr = { process: mocks.process }
  },
}))
import { extraerPlanilla } from './extraerPlanilla'
const exito: ExtraccionResult = {
  ok: true,
  data: {
    numero_remito: { value: '1', confidence: 1 },
    fecha: { value: '2026-09-03', confidence: 1 },
    color: { value: null, confidence: 0 },
    ot: { value: null, confidence: 0 },
    rem_tejeduria: { value: null, confidence: 0 },
    referencia: { value: null, confidence: 0 },
    total_rollos_declarado: { value: 1, confidence: 1 },
    total_kilos_declarado: { value: 10, confidence: 1 },
    rollos: [
      {
        numero_pieza: { value: 'A', confidence: 1 },
        kilos: { value: 10, confidence: 1 },
        metros: { value: null, confidence: 0 },
        ratio: { value: null, confidence: 0 },
        gramaje_planilla: { value: null, confidence: 0 },
        articulo: { value: null, confidence: 0 },
        color: { value: null, confidence: 0 },
      },
    ],
  },
}


describe('extracción estructurada con Mistral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('MISTRAL_API_KEY', 'test-key')
    vi.stubEnv('MISTRAL_OCR_MODEL', '')
    mocks.process.mockResolvedValue({ documentAnnotation: JSON.stringify(exito.ok && exito.data) })
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each(['application/pdf', 'image/jpeg', 'image/png'])('envía %s y devuelve los campos sin otro proveedor', async mime => {
    expect(await extraerPlanilla(Buffer.from('archivo'), mime, 'Pistas tintorería')).toEqual(exito)
    const request = mocks.process.mock.calls[0][0]
    expect(request.document).toEqual(mime === 'application/pdf'
      ? { type: 'document_url', documentUrl: 'data:application/pdf;base64,YXJjaGl2bw==' }
      : { type: 'image_url', imageUrl: `data:${mime};base64,YXJjaGl2bw==` })
    expect(request.documentAnnotationFormat.type).toBe('json_schema')
    expect(request.documentAnnotationPrompt).toContain('Pistas tintorería')
    expect(request.documentAnnotationFormat.jsonSchema.schemaDefinition.properties.rollos.items.required).toContain('kilos')
    expect(mocks.process).toHaveBeenCalledTimes(1)
    expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 100_000, retryConfig: { strategy: 'none' } }))
  })
  it('no llama a la API sin clave', async () => {
    vi.stubEnv('MISTRAL_API_KEY', '')
    expect(await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)).toMatchObject({ ok: false, codigo: 'NO_API_KEY' })
    expect(mocks.process).not.toHaveBeenCalled()
  })
  it.each([undefined, 'no json', '{}', '{"rollos":[{}]}', 'null'])('rechaza anotaciones inválidas: %s', async annotation => {
    mocks.process.mockResolvedValue({ documentAnnotation: annotation })
    expect(await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)).toMatchObject({ ok: false, codigo: 'JSON_INVALID' })
  })
  it('rechaza tipos incorrectos aunque el JSON sea válido', async () => {
    if (!exito.ok) throw new Error('fixture')
    const data = structuredClone(exito.data)
    data.rollos[0].kilos.confidence = 5
    mocks.process.mockResolvedValue({ documentAnnotation: JSON.stringify(data) })
    expect(await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)).toMatchObject({ ok: false, codigo: 'JSON_INVALID' })
  })
  it('permite resultados parciales para revisión sin inventar rollos', async () => {
    if (!exito.ok) throw new Error('fixture')
    const data = structuredClone(exito.data)
    data.total_rollos_declarado.value = 10
    mocks.process.mockResolvedValue({ documentAnnotation: JSON.stringify(data) })
    const result = await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)
    expect(result.ok && result.data.rollos).toHaveLength(1)
  })
  it.each([[401, 'MISTRAL_ERROR'], [402, 'AI_QUOTA_EXCEEDED'], [429, 'AI_QUOTA_EXCEEDED'], [408, 'AI_TIMEOUT'], [503, 'AI_UNAVAILABLE'], [404, 'AI_MODEL_UNAVAILABLE']])('maneja HTTP %s', async (statusCode, codigo) => {
    mocks.process.mockRejectedValue({ statusCode, message: 'secret-body' })
    const result = await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)
    expect(result).toMatchObject({ ok: false, codigo })
    expect(JSON.stringify(result)).not.toContain('secret-body')
  })
  it('maneja cancelaciones por timeout', async () => {
    mocks.process.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    expect(await extraerPlanilla(Buffer.from('x'), 'image/jpeg', null)).toMatchObject({ ok: false, codigo: 'AI_TIMEOUT' })
  })
})
