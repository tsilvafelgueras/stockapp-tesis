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
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onReadRef = useRef(onRead)
  const lastReadRef = useRef<{ texto: string; at: number } | null>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [manualValue, setManualValue] = useState('')
  const [scanSuccess, setScanSuccess] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  const releaseScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null

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
    const texto = result.texto.trim()
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
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoRef.current,
          (result, error) => {
            if (result) {
              emitRead({
                texto: result.getText(),
                formato: result.getBarcodeFormat(),
              })
            }

            if (error && !(error instanceof NotFoundException)) {
              console.warn('Scanner error:', error)
            }
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        streamRef.current = videoRef.current?.srcObject as MediaStream | null
        setStatus('ready')
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
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div
                  className={`h-full max-h-52 w-full max-w-72 rounded-lg border-4 border-white/90 transition-colors ${
                    scanSuccess ? 'scan-success' : ''
                  }`}
                />
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
