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
          href="/operario/despachos/nuevo"
          className="w-full rounded-2xl border-2 border-primary bg-primary/5 p-6 text-left active:scale-95 transition-transform"
        >
          <span className="block text-lg font-semibold">
            Cargar despacho a mano
          </span>
          <span className="block text-sm text-muted-foreground mt-1">
            Ingresar rollos cuando llega mercadería sin planilla digital
          </span>
        </Link>

        <Link
          href="/operario/despachos"
          className="w-full rounded-2xl border-2 p-6 text-left active:scale-95 transition-transform hover:bg-zinc-50"
        >
          <span className="block text-lg font-semibold">Ver despachos</span>
          <span className="block text-sm text-muted-foreground mt-1">
            Listado de despachos cargados y pendientes
          </span>
        </Link>

        <button
          disabled
          className="w-full rounded-2xl border-2 p-6 text-left opacity-50 cursor-not-allowed"
        >
          <span className="block text-lg font-semibold">
            Confirmar llegada de rollos
          </span>
          <span className="block text-sm text-muted-foreground mt-1">
            Escanear o tocar los rollos pendientes (Etapa 4)
          </span>
        </button>

        <button
          disabled
          className="w-full rounded-2xl border-2 p-6 text-left opacity-50 cursor-not-allowed"
        >
          <span className="block text-lg font-semibold">
            Picking de pedidos
          </span>
          <span className="block text-sm text-muted-foreground mt-1">
            Preparar pedidos pendientes (Etapa 6)
          </span>
        </button>
      </div>
    </div>
  )
}
