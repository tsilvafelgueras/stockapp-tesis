'use client'

import QRCode from 'react-qr-code'
import type { EtiquetaConfig } from './etiqueta-config'

export type RolloEtiqueta = {
  id: string
  numero_pieza: string
  kilos: number
  ubicacion: string | null
  articulo: string
  color: string
  numero_lote: string
  ot: string | null
  fecha_despacho: string
  tintoreria: string
}

// Rollo de ejemplo para la vista previa de ajustes.
export const ROLLO_EJEMPLO: RolloEtiqueta = {
  id: 'preview',
  numero_pieza: '7',
  kilos: 42.5,
  ubicacion: 'A-12',
  articulo: 'Morley',
  color: 'Negro',
  numero_lote: '1234',
  ot: '8842',
  fecha_despacho: '2026-06-26',
  tintoreria: 'Demo',
}

export function padNumero(n: string): string {
  const num = parseInt(n)
  if (isNaN(num)) return n
  return String(num).padStart(3, '0')
}

export function formatFecha(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  rollo: RolloEtiqueta
  config: EtiquetaConfig
  // Escala física aplicada a las medidas en mm. En pantalla (preview) se usa 1
  // (medida real intencionada). Al imprimir se pasa config.factor_escala para
  // compensar el reescalado del driver. Las fuentes usan cqmin, así que escalan
  // solas con el tamaño de la caja — no hay que tocarlas.
  escala?: number
  className?: string
}

// Una etiqueta. La caja se dimensiona en mm (medida física) y declara
// `container-type: size`, de modo que todo el contenido interno expresado en
// cqmin escala proporcionalmente a cualquier medida (5×5, 10×10, 10×15…).
export function EtiquetaLabel({ rollo, config, escala = 1, className = '' }: Props) {
  const w = config.ancho_mm * escala
  const h = config.alto_mm * escala
  const pad = config.padding_mm * escala
  const qr = config.qr_mm * escala

  return (
    <div
      className={`etiqueta-print flex flex-col bg-white text-black ${className}`}
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        padding: `${pad}mm`,
        boxSizing: 'border-box',
        containerType: 'size',
        overflow: 'hidden',
      }}
    >
      {/* Encabezado empresa */}
      <div
        className="shrink-0 text-center"
        style={{ borderBottom: '0.5cqmin solid black', paddingBottom: '1cqmin' }}
      >
        <p
          className="font-bold uppercase leading-tight"
          style={{ fontSize: '4.5cqmin', letterSpacing: '0.15em' }}
        >
          NUDO · {rollo.tintoreria.toUpperCase()}
        </p>
      </div>

      {/* Bloque principal: QR + número grande */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ gap: '3cqmin', padding: '1cqmin 0' }}
      >
        <QRCode
          value={rollo.numero_pieza}
          size={256}
          bgColor="#ffffff"
          fgColor="#000000"
          style={{ width: `${qr}mm`, height: `${qr}mm`, flexShrink: 0 }}
        />
        <div className="min-w-0 flex-1 text-center">
          <p
            className="font-bold uppercase leading-none"
            style={{ fontSize: '3.5cqmin', letterSpacing: '0.15em' }}
          >
            Pieza
          </p>
          <p
            className="font-black leading-none"
            style={{ fontSize: '26cqmin', letterSpacing: '-0.02em' }}
          >
            {padNumero(rollo.numero_pieza)}
          </p>
        </div>
      </div>

      {/* Datos — fila inferior */}
      <div
        className="shrink-0 grid grid-cols-2 leading-tight"
        style={{
          fontSize: '3.4cqmin',
          columnGap: '3cqmin',
          rowGap: '0.5cqmin',
          borderTop: '0.5cqmin solid black',
          paddingTop: '1cqmin',
        }}
      >
        <Dato label="OT" valor={rollo.ot || '—'} />
        <Dato label="Color" valor={rollo.color} />
        <Dato label="Tela" valor={rollo.articulo} />
        <Dato label="Kilos" valor={String(rollo.kilos)} />
        {rollo.ubicacion && <Dato label="Ubic." valor={rollo.ubicacion} />}
        <Dato label="Fecha" valor={formatFecha(rollo.fecha_despacho)} />
      </div>
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between" style={{ gap: '1cqmin' }}>
      <span className="font-medium">{label}</span>
      <span className="font-bold truncate">{valor}</span>
    </div>
  )
}
