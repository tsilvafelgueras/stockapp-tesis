const racks = ['A', 'B', 'C', 'D', 'E', 'F']

export const UBICACIONES: string[] = [
  'A ordenar',
  'Sin ubicar',
  ...racks.flatMap((rack) =>
    Array.from({ length: 30 }, (_, i) => `${rack}${i + 1}`)
  ),
]
