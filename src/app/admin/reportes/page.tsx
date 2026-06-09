import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import {
  reporteMerma,
  reporteTintorerias,
  reporteStockKpis,
  reporteStockPorCombo,
  reporteCobertura,
  reporteRotacionABC,
  reporteRollosViejos,
  reporteStockPorEstado,
  reporteDemandaActiva,
  reporteFunnelPedidos,
  reporteTiempoPorEtapa,
  reporteRankingClientes,
  reportePedidosCancelados,
  reporteTintoreriaPerformance,
  reporteFallasPorCategoria,
  reporteKilosDegradados,
  reporteMuestras,
  reporteDiferenciaGramaje,
  reporteMermaPartida,
  reporteOrigenIngresos,
  reporteTendenciaMensual,
  reporteHealthCheck,
  reporteActividadUsuarios,
  type ReportesFilters as ReportesFiltersType,
} from './queries'
import ReportesFilters from './ReportesFilters'
import ReportesTabs from './components/ReportesTabs'
import { normalizeTab } from './components/tabs'
import TabStock from './components/TabStock'
import TabDemanda from './components/TabDemanda'
import TabTintorerias from './components/TabTintorerias'
import TabCalidad from './components/TabCalidad'
import TabEficiencia from './components/TabEficiencia'
import ReportesAgentWidget from './ReportesAgentWidget'

type SearchParams = {
  tab?: string
  dias?: string
  anio?: string
  mes?: string
  tintoreria?: string
  articulo?: string
  desde?: string
  hasta?: string
}

function splitParam(value?: string): string[] {
  return value?.split(',').map((v) => v.trim()).filter(Boolean) ?? []
}

function buildCsvHref(
  tipo: string,
  filters: ReportesFiltersType,
  extra?: Record<string, string | number>
): string {
  const sp = new URLSearchParams({ tipo })
  const tintorerias = filters.tintoreriaIds ?? []
  const articulos = filters.articuloIds ?? []
  const meses = filters.meses ?? []
  if (tintorerias.length) sp.set('tintoreria', tintorerias.join(','))
  if (articulos.length) sp.set('articulo', articulos.join(','))
  if (filters.anio) sp.set('anio', String(filters.anio))
  if (meses.length) sp.set('mes', meses.join(','))
  if (filters.desde) sp.set('desde', filters.desde)
  if (filters.hasta) sp.set('hasta', filters.hasta)
  if (extra) for (const [k, v] of Object.entries(extra)) sp.set(k, String(v))
  return `/admin/reportes/csv?${sp.toString()}`
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const tab = normalizeTab(sp.tab)
  const anioActual = new Date().getFullYear()
  const meses = splitParam(sp.mes)
    .map(Number)
    .filter((n) => n >= 1 && n <= 12)
  const tintoreriaIds = splitParam(sp.tintoreria)
  const articuloIds = splitParam(sp.articulo)

  const filters: ReportesFiltersType = {
    tintoreriaIds,
    articuloIds,
    anio: sp.anio ? Number(sp.anio) : anioActual,
    meses,
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
  }

  const supabase = await createClient()

  // Catálogos para los filtros (siempre).
  const [{ data: empresaTints }, { data: articulos }, { data: aniosRollos }] =
    await Promise.all([
      supabase
        .from('empresa_tintorerias')
        .select('tintorerias ( id, nombre )')
        .eq('activo', true),
      supabase
        .from('articulos')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre'),
      supabase.from('rollos').select('created_at').limit(2000),
    ])

  type EmpresaTintRow = { tintorerias: { id: string; nombre: string } | null }
  const tintorerias = ((empresaTints ?? []) as unknown as EmpresaTintRow[])
    .map((r) => r.tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const aniosSet = new Set<number>()
  for (const r of aniosRollos ?? []) {
    if (r.created_at) aniosSet.add(new Date(r.created_at).getFullYear())
  }
  const anios = [...aniosSet]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <DashboardBackButton />
        <h1 className="mt-1 font-heading text-xl font-bold sm:text-2xl">
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Tablero de gestión: stock, demanda, proveedores, calidad y operación.
        </p>
      </div>

      <ReportesFilters
        current={{
          anio: sp.anio ?? String(anioActual),
          meses: splitParam(sp.mes),
          tintorerias: tintoreriaIds,
          articulos: articuloIds,
          desde: sp.desde ?? '',
          hasta: sp.hasta ?? '',
        }}
        tintorerias={tintorerias ?? []}
        articulos={articulos ?? []}
        anios={anios}
      />

      <ReportesTabs active={tab} />

      {tab === 'stock' && <StockTab filters={filters} buildCsvHref={buildCsvHref} />}
      {tab === 'demanda' && (
        <DemandaTab filters={filters} buildCsvHref={buildCsvHref} />
      )}
      {tab === 'tintorerias' && (
        <TintoreriasTab filters={filters} buildCsvHref={buildCsvHref} />
      )}
      {tab === 'calidad' && (
        <CalidadTab filters={filters} buildCsvHref={buildCsvHref} />
      )}
      {tab === 'eficiencia' && (
        <EficienciaTab filters={filters} buildCsvHref={buildCsvHref} />
      )}
      <ReportesAgentWidget />
    </div>
  )
}

type TabProps = {
  filters: ReportesFiltersType
  buildCsvHref: typeof buildCsvHref
}

// ── Bloque A ────────────────────────────────────────────────
async function StockTab({ filters, buildCsvHref }: TabProps) {
  const supabase = await createClient()
  const [kpis, stock, cobertura, abc, viejos, porEstado] = await Promise.all([
    reporteStockKpis(supabase, filters),
    reporteStockPorCombo(supabase, filters),
    reporteCobertura(supabase, filters),
    reporteRotacionABC(supabase, filters),
    reporteRollosViejos(supabase, filters),
    reporteStockPorEstado(supabase, filters),
  ])

  return (
    <TabStock
      data={{ kpis, stock, cobertura, abc, viejos, porEstado }}
      csv={{
        stock: buildCsvHref('stock-combo', filters),
        cobertura: buildCsvHref('cobertura', filters),
        abc: buildCsvHref('abc', filters),
        viejos: buildCsvHref('viejos', filters),
      }}
    />
  )
}

// ── Bloque B ────────────────────────────────────────────────
async function DemandaTab({ filters, buildCsvHref }: TabProps) {
  const supabase = await createClient()
  const [demanda, funnel, tiempo, ranking, cancelados] = await Promise.all([
    reporteDemandaActiva(supabase, filters),
    reporteFunnelPedidos(supabase, filters),
    reporteTiempoPorEtapa(supabase, filters),
    reporteRankingClientes(supabase, filters),
    reportePedidosCancelados(supabase, filters),
  ])
  return (
    <TabDemanda
      data={{ demanda, funnel, tiempo, ranking, cancelados }}
      csv={{
        demanda: buildCsvHref('demanda', filters),
        ranking: buildCsvHref('ranking', filters),
        cancelados: buildCsvHref('cancelados', filters),
      }}
    />
  )
}

// ── Bloque C ────────────────────────────────────────────────
async function TintoreriasTab({ filters, buildCsvHref }: TabProps) {
  const supabase = await createClient()
  const [performance, volumen] = await Promise.all([
    reporteTintoreriaPerformance(supabase, filters),
    reporteTintorerias(supabase, filters),
  ])
  return (
    <TabTintorerias
      data={{ performance, volumen }}
      csv={{
        scorecard: buildCsvHref('scorecard', filters),
        volumen: buildCsvHref('tintorerias', filters),
      }}
    />
  )
}

// ── Bloque D ────────────────────────────────────────────────
async function CalidadTab({ filters, buildCsvHref }: TabProps) {
  const supabase = await createClient()
  const [fallas, degradados, muestras, gramaje, merma, mermaPartida] =
    await Promise.all([
      reporteFallasPorCategoria(supabase, filters),
      reporteKilosDegradados(supabase, filters),
      reporteMuestras(supabase, filters),
      reporteDiferenciaGramaje(supabase, filters),
      reporteMerma(supabase, filters),
      reporteMermaPartida(supabase, filters),
    ])
  return (
    <TabCalidad
      data={{ fallas, degradados, muestras, gramaje, merma, mermaPartida }}
      csv={{
        merma: buildCsvHref('merma', filters),
        muestras: buildCsvHref('muestras', filters),
        gramaje: buildCsvHref('gramaje', filters),
        mermaPartida: buildCsvHref('merma-partida', filters),
      }}
    />
  )
}

// ── Bloque E ────────────────────────────────────────────────
async function EficienciaTab({ filters, buildCsvHref }: TabProps) {
  const supabase = await createClient()
  const [origen, tendencia, health, actividad] = await Promise.all([
    reporteOrigenIngresos(supabase, filters),
    reporteTendenciaMensual(supabase, filters),
    reporteHealthCheck(supabase, filters),
    reporteActividadUsuarios(supabase, filters),
  ])
  return (
    <TabEficiencia
      data={{ origen, tendencia, health, actividad }}
      csv={{
        tendencia: buildCsvHref('tendencia', filters),
        actividad: buildCsvHref('actividad', filters),
      }}
    />
  )
}
