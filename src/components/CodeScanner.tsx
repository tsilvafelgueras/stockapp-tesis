'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library'

export type CodeScannerResult = {
  texto: string
  formato: BarcodeFormat | null
}

type ScannerStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

type ImageCaptureConstructor = new (
  track: MediaStreamTrack
) => {
  getPhotoCapabilities?: () => Promise<unknown>
}

type TorchConstraint = MediaTrackConstraintSet & {
  torch?: boolean
}

type ScannerVideoConstraints = MediaTrackConstraints & {
  focusMode?: ConstrainDOMString
}

declare global {
  interface Window {
    ImageCapture?: ImageCaptureConstructor
    webkitAudioContext?: typeof AudioContext
  }
}

const SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
]

const SCAN_COOLDOWN_MS = 2000
const SUCCESS_MS = 800
const SCAN_INTERVAL_MS = 120
const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 480

export default function CodeScanner({
  onRead,
  paused = false,
  title = 'Escanear código',
  manualLabel = 'Código manual',
  manualPlaceholder = 'Escaneá o ingresá el código',
  variant = 'embedded',
  className = '',
}: {
  onRead: (result: CodeScannerResult) => void
  paused?: boolean
  title?: string
  manualLabel?: string
  manualPlaceholder?: string
  variant?: 'standalone' | 'embedded'
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onReadRef = useRef(onRead)
  const lastReadRef = useRef<{ texto: string; at: number } | null>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [manualValue, setManualValue] = useState('')
  const [scanSuccess, setScanSuccess] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  const releaseScanner = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    const readerWithReset = readerRef.current as
      | (BrowserMultiFormatReader & { reset?: () => void })
      | null
    readerWithReset?.reset?.()
    readerRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const stopScanner = useCallback((resetTorchState = false) => {
    releaseScanner()
    if (resetTorchState) setTorchOn(false)
  }, [releaseScanner])

  const emitRead = useCallback((result: CodeScannerResult) => {
    const texto = normalizeDecodedText(result.texto)
    if (!texto) return

    const now = Date.now()
    const last = lastReadRef.current
    if (last?.texto === texto && now - last.at < SCAN_COOLDOWN_MS) return
    lastReadRef.current = { texto, at: now }

    setScanSuccess(true)
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    successTimeoutRef.current = setTimeout(() => {
      setScanSuccess(false)
    }, SUCCESS_MS)

    beep()
    navigator.vibrate?.(100)
    onReadRef.current({ texto, formato: result.formato })
  }, [])

  useEffect(() => {
    if (paused) {
      releaseScanner()
      queueMicrotask(() => {
        setStatus('idle')
        setTorchOn(false)
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setStatus('unsupported'))
      return
    }

    let cancelled = false

    async function startScanner() {
      if (!videoRef.current) return

      releaseScanner()
      setStatus('starting')

      const hints = new Map<DecodeHintType, unknown>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS)
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            focusMode: { ideal: 'continuous' },
          } as ScannerVideoConstraints,
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        setStatus('ready')

        const scanFrame = () => {
          if (cancelled || !videoRef.current || !canvasRef.current) return

          if (preprocessFrame(videoRef.current, canvasRef.current)) {
            try {
              const result = reader.decodeFromCanvas(canvasRef.current)
              emitRead({
                texto: result.getText(),
                formato: result.getBarcodeFormat(),
              })
            } catch (error) {
              if (error && !(error instanceof NotFoundException)) {
                console.warn('Scanner error:', error)
              }
            }
          }

          scanTimeoutRef.current = setTimeout(scanFrame, SCAN_INTERVAL_MS)
        }

        scanFrame()
      } catch (error) {
        if (cancelled) return
        releaseScanner()

        const name = error instanceof Error ? error.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('permission-denied')
          return
        }

        console.warn('Scanner init error:', error)
        setStatus('error')
      }
    }

    void startScanner()

    return () => {
      cancelled = true
      releaseScanner()
    }
  }, [emitRead, paused, releaseScanner])

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      stopScanner()
    }
  }, [stopScanner])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return

    try {
      const ctor = window.ImageCapture as ImageCaptureConstructor | undefined
      if (!ctor) return

      const imageCapture = new ctor(track)
      await imageCapture.getPhotoCapabilities?.()

      const next = !torchOn
      await track.applyConstraints({
        advanced: [{ torch: next } as TorchConstraint],
      })
      setTorchOn(next)
    } catch {
      // Torch is not supported consistently across browsers/devices.
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const texto = manualValue.trim()
    if (!texto) return
    emitRead({ texto, formato: null })
    setManualValue('')
  }

  const standalone = variant === 'standalone'

  return (
    <section
      className={`space-y-3 ${
        standalone ? 'mx-auto w-full max-w-xl p-4 sm:p-6' : ''
      } ${className}`}
    >
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          {status !== 'unsupported' && (
            <button
              type="button"
              onClick={toggleTorch}
              className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:border-action/40 hover:bg-zinc-50"
            >
              {torchOn ? 'Apagar linterna' : 'Linterna'}
            </button>
          )}
        </div>

        {status === 'unsupported' ? (
          <CameraMessage
            title="Este navegador no permite usar la cámara"
            text="Usá HTTPS o localhost para habilitar getUserMedia. Mientras tanto, podés ingresar el código manualmente con el campo de abajo."
          />
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg bg-black">
            <div className="relative aspect-[4/3] w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" aria-hidden />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div
                  className={`relative size-52 max-h-[70vw] max-w-[70vw] transition-colors ${
                    scanSuccess ? 'scan-success' : ''
                  }`}
                >
                  <div className="scanner-corner absolute left-0 top-0 size-10 rounded-tl border-l-4 border-t-4 border-white/80" />
                  <div className="scanner-corner absolute right-0 top-0 size-10 rounded-tr border-r-4 border-t-4 border-white/80" />
                  <div className="scanner-corner absolute bottom-0 left-0 size-10 rounded-bl border-b-4 border-l-4 border-white/80" />
                  <div className="scanner-corner absolute bottom-0 right-0 size-10 rounded-br border-b-4 border-r-4 border-white/80" />
                </div>
              </div>

              {status === 'starting' && (
                <CameraOverlay>Iniciando cámara...</CameraOverlay>
              )}

              {status === 'permission-denied' && (
                <CameraOverlay>
                  <span className="block font-semibold">
                    No tenemos permiso para usar la cámara.
                  </span>
                  <span className="mt-1 block text-xs text-white/75">
                    Habilitá la cámara desde el candado del navegador y recargá
                    la página. También podés ingresar el código manualmente.
                  </span>
                </CameraOverlay>
              )}

              {status === 'error' && (
                <CameraOverlay>
                  No se pudo iniciar la cámara. Probá recargar la página o usá
                  HTTPS/localhost y el ingreso manual.
                </CameraOverlay>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {manualLabel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={manualPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-input bg-white px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={!manualValue.trim()}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground transition-colors hover:bg-action/90 disabled:opacity-50"
            >
              Usar código
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function CameraOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white">
      <p>{children}</p>
    </div>
  )
}

function CameraMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  )
}

function normalizeDecodedText(value: string): string | null {
  const texto = value.trim()
  if (!texto) return null
  if (/^https?:\/\//i.test(texto)) return null
  if (texto.length > 50) return null
  return texto
}

function preprocessFrame(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement
): boolean {
  if (!videoEl.videoWidth || !videoEl.videoHeight) return false

  if (canvasEl.width !== CANVAS_WIDTH) canvasEl.width = CANVAS_WIDTH
  if (canvasEl.height !== CANVAS_HEIGHT) canvasEl.height = CANVAS_HEIGHT

  const ctx = canvasEl.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const roiX = videoEl.videoWidth * 0.1
  const roiY = videoEl.videoHeight * 0.1
  const roiW = videoEl.videoWidth * 0.8
  const roiH = videoEl.videoHeight * 0.8

  ctx.drawImage(
    videoEl,
    roiX,
    roiY,
    roiW,
    roiH,
    0,
    0,
    canvasEl.width,
    canvasEl.height
  )

  const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const val = avg > 128 ? 255 : 0
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
  }

  ctx.putImageData(imageData, 0, 0)
  return true
}

function beep() {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return

    const ctx = new AudioContextCtor()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 1200
    gain.gain.value = 0.08

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.15)
    oscillator.onended = () => {
      void ctx.close()
    }
  } catch {
    // Audio feedback is best-effort only.
  }
}
