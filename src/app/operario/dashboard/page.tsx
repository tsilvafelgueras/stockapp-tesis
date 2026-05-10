import Link from 'next/link'

export default function OperarioDashboard() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Depósito</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ¿Qué vas a hacer hoy?
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link
          href="/operario/ingresos/nuevo"
          className="w-full rounded-2xl border-2 border-primary bg-primary/5 p-6 text-left active:scale-95 transition-transform"
        >
          <span className="block text-lg font-semibold">Cargar ingreso</span>
          <span className="block text-sm text-muted-foreground mt-1">
            Subir planilla con IA o cargar a mano cuando llega mercadería
          </span>
        </Link>

        <Link
          href="/operario/ingresos"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">Ver ingresos</span>
          <span className="block text-sm text-muted-foreground mt-1">
            Listado de ingresos cargados y pendientes
          </span>
        </Link>

        <Link
          href="/stock"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">Ver stock</span>
          <span className="block text-sm text-muted-foreground mt-1">
            Buscar rollos disponibles y mover ubicaciones
          </span>
        </Link>

        <Link
          href="/operario/confirmar"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">
            Confirmar llegada de rollos
          </span>
          <span className="block text-sm text-muted-foreground mt-1">
            Escanear los rollos pendientes y asignarles ubicación
          </span>
        </Link>

        <Link
          href="/operario/picking"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">
            Picking de pedidos
          </span>
          <span className="block text-sm text-muted-foreground mt-1">
            Preparar pedidos pendientes escaneando los rollos
          </span>
        </Link>

        <Link
          href="/operario/muestras"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">Muestras</span>
          <span className="block text-sm text-muted-foreground mt-1">
            Registrar entregas chicas que se descuentan del rollo
          </span>
        </Link>
      </div>
    </div>
  )
}
