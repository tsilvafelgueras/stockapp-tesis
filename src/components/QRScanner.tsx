'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode'
import type { CodeScannerResult } from './CodeScanner'

type ScannerStatus =
  | 'starting'
  | 'ready'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

const STARTING_OVERLAY_MS = 1200
const SUCCESS_MS = 800
const FPS = 10

/**
 * Lector específico para códigos QR (html5-qrcode). Misma API pública que
 * CodeScanner para ser usado por ScannerByReaderType cuando la tintorería
 * tiene reader_type='qr'. No lee códigos de barras 1D.
 */
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
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const containerId = `qr-scanner-${useId().replace(/:/g, '')}`

  const [status, setStatus] = useState<ScannerStatus>('starting')
  const [manualValue, setManualValue] = useState('')
  const [scanSuccess, setScanSuccess] = useState(false)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

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

    const startTimer = setTimeout(() => {
      setStatus((s) => (s === 'starting' ? 'ready' : s))
    }, STARTING_OVERLAY_MS)

    const instance = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    })
    html5QrcodeRef.current = instance

    instance
      .start(
        { facingMode: 'environment' },
        {
          fps: FPS,
          aspectRatio: 4 / 3,
          disableFlip: false,
        },
        (decodedText) => {
          emitRead({ texto: decodedText, formato: 'qr_code' })
        },
        () => {
          // Cada frame sin código dispara este callback. Lo ignoramos.
        }
      )
      .catch((err: unknown) => {
        const msg = typeof err === 'string' ? err : (err as Error)?.message ?? ''
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setStatus('permission-denied')
          return
        }
        if (
          msg.toLowerCase().includes('insecure') ||
          msg.toLowerCase().includes('not supported')
        ) {
          setStatus('unsupported')
          return
        }
        console.warn('QRScanner start error:', err)
        setStatus('error')
      })

    return () => {
      clearTimeout(startTimer)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      const inst = html5QrcodeRef.current
      html5QrcodeRef.current = null
      if (inst && inst.isScanning) {
        inst.stop().catch(() => undefined)
      }
    }
    // containerId is derived from useId() which is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitRead])

  useEffect(() => {
    const inst = html5QrcodeRef.current
    if (!inst) return
    if (paused) {
      if (inst.isScanning) {
        try {
          inst.pause(true)
        } catch {
          /* noop */
        }
      }
    } else {
      try {
        inst.resume()
      } catch {
        /* noop */
      }
    }
  }, [paused])

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
              <div
                id={containerId}
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
