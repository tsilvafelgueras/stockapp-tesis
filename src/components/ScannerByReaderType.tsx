'use client'

import CodeScanner, { type CodeScannerResult } from './CodeScanner'
import QRScanner from './QRScanner'
import BarcodeScanner from './BarcodeScanner'

export type ReaderType = 'qr' | 'barcode' | null

type Props = {
  readerType: ReaderType
  onRead: (result: CodeScannerResult) => void
  paused?: boolean
  title?: string
  manualLabel?: string
  manualPlaceholder?: string
  /** Oculta el input de "código manual" debajo de la cámara (en el alta de
      ingreso el código se carga por pieza, no hace falta el manual del scanner). */
  hideManualInput?: boolean
  variant?: 'standalone' | 'embedded'
  className?: string
}

/**
 * Wrapper que elige el lector apropiado según la config de la tintorería:
 *   - 'qr'      → QRScanner       (html5-qrcode)
 *   - 'barcode' → BarcodeScanner  (@zxing/browser)
 *   - null      → CodeScanner     (lector unificado, fallback histórico)
 *
 * Sirve para mantener un único punto de integración en las pantallas que
 * escanean rollos (Confirmar llegadas y Picking).
 */
export default function ScannerByReaderType({
  readerType,
  ...props
}: Props) {
  if (readerType === 'qr') return <QRScanner {...props} />
  if (readerType === 'barcode') return <BarcodeScanner {...props} />
  return <CodeScanner {...props} />
}
