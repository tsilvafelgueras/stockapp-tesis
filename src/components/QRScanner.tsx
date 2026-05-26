'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readBarcodes,
  prepareZXingModule,
  type ReaderOptions,
} from 'zxing-wasm/reader'
import type { CodeScannerResult } from './CodeScanner'

type ScannerStatus =
  | 'starting'
  | 'ready'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

const STARTING_OVERLAY_MS = 1200
const SUCCESS_MS = 800
const SCAN_INTERVAL_MS = 100

const READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  tryDenoise: true,
  maxNumberOfSymbols: 1,
}

export default function QRScanner({
  onRead,
  paused = false,
  title = 'Escanear código QR',
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
  const onReadRef = useRef(onRead)
  const pausedRef = useRef(paused)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<ScannerStatus>('starting')
  const [manualValue, setManualValue] = useState('')
  const [scanSuccess, setScanSuccess] = useState(false)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const emitRead = useCallback((result: CodeScannerResult) => {
    const texto = result.texto.trim()
    if (!texto) return

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
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      queueMicrotask(() => setStatus('unsupported'))
      return
    }

    let cancelled = false
    const video = videoRef.current
    if (!video) return

    const startTimer = setTimeout(() => {
      setStatus((s) => (s === 'starting' ? 'ready' : s))
    }, STARTING_OVERLAY_MS)

    void prepareZXingModule({ fireImmediately: true }).catch(() => undefined)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const track = stream.getVideoTracks()[0]
        if (track) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            })
          } catch {
            // focusMode no es soportado en todos los navegadores; ignorar.
          }
        }

        video!.srcObject = stream
        await video!.play()
        scanLoop()
      } catch (err) {
        const name = (err as Error)?.name ?? ''
        const msg = (err as Error)?.message ?? String(err)
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('permission-denied')
          return
        }
        if (
          name === 'NotFoundError' ||
          name === 'OverconstrainedError' ||
          msg.toLowerCase().includes('insecure')
        ) {
          setStatus('unsupported')
          return
        }
        console.warn('QRScanner start error:', err)
        setStatus('error')
      }
    }

    async function scanLoop() {
      while (!cancelled) {
        if (
          !pausedRef.current &&
          ctx &&
          video!.readyState >= 2 &&
          video!.videoWidth > 0
        ) {
          try {
            if (canvas.width !== video!.videoWidth) {
              canvas.width = video!.videoWidth
              canvas.height = video!.videoHeight
            }
            ctx.drawImage(video!, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const results = await readBarcodes(imageData, READER_OPTIONS)
            if (cancelled) break
            const hit = results[0]
            if (hit?.text) {
              emitRead({ texto: hit.text, formato: 'qr_code' })
              await sleep(SUCCESS_MS)
              continue
            }
          } catch {
            // Frame inválido o wasm aún cargando; reintento en el próximo tick.
          }
        }
        await sleep(SCAN_INTERVAL_MS)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      const stream = streamRef.current
      streamRef.current = null
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      if (video) {
        video.srcObject = null
      }
    }
  }, [emitRead])

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
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            QR
          </span>
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
                className="absolute inset-0 h-full w-full object-cover"
                muted
                playsInline
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
                <CameraOverlay>Iniciando cámara…</CameraOverlay>
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
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white">
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

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
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
