'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeResult,
} from 'html5-qrcode'

export type CodeScannerResult = {
  texto: string
  formato: string | null
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
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
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
  const reactId = useId()
  const scannerElementId = `code-scanner-${reactId.replace(/:/g, '')}`

  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
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

  const releaseScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    scannerRef.current = null
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      scanner.clear()
    } catch {
      // best-effort cleanup
    }
  }, [])

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
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setStatus('unsupported'))
      return
    }

    let cancelled = false

    async function startScanner() {
      if (!containerRef.current) return

      setStatus('starting')

      const scanner = new Html5Qrcode(scannerElementId, {
        formatsToSupport: SUPPORTED_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      })
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            aspectRatio: 4 / 3,
            disableFlip: false,
          },
          (decodedText: string, decodedResult: Html5QrcodeResult) => {
            const formato = decodedResult?.result?.format?.formatName ?? null
            emitRead({ texto: decodedText, formato })
          },
          () => {
            // per-frame errors are normal when no code is in view
          }
        )

        if (cancelled) {
          void releaseScanner()
          return
        }

        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        void releaseScanner()

        const message =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error)

        if (
          /NotAllowedError|Permission|denied/i.test(message)
        ) {
          setStatus('permission-denied')
          return
        }

        console.warn('Scanner init error:', error)
        setStatus('error')
      }
    }

    if (paused) {
      void releaseScanner().then(() => {
        if (!cancelled) {
          setStatus('idle')
          setTorchOn(false)
        }
      })
    } else {
      void startScanner()
    }

    return () => {
      cancelled = true
      void releaseScanner()
    }
  }, [emitRead, paused, releaseScanner, scannerElementId])

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  async function toggleTorch() {
    const video = containerRef.current?.querySelector('video')
    const stream = video?.srcObject as MediaStream | null | undefined
    const track = stream?.getVideoTracks()[0]
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
              <div
                id={scannerElementId}
                ref={containerRef}
                className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
              />
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
