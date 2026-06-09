import type { MetadataRoute } from 'next'

// Manifest de la PWA (aplica a TODOS los roles: el root layout es único).
// `display: standalone` + los meta tags de Apple (en layout.tsx) son los que
// hacen que al "Agregar a inicio" en iOS la app abra a pantalla completa, sin
// las barras de Safari.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NUDO — StockApp',
    short_name: 'NUDO',
    description: 'WMS ligero para PyMEs textiles argentinas',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1A2744',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
