-- ============================================================
-- Migración 018 — Limpieza de data de prueba + unicidad
--
-- Cambios:
--   1) TRUNCATE de todas las tablas transaccionales (rollos,
--      ingresos, pedidos, pedido_rollos, muestras,
--      pedidos_pendientes). La data anterior era toda de prueba
--      y se descartó por decisión explícita.
--      Se mantienen: empresas, profiles, articulos, tintorerias.
--
--   2) `empresas.nombre` pasa a UNIQUE. Antes era TEXT libre y
--      permitía dos "Muter Textil" (bug CU-02-02).
--
--   3) `rollos.numero_pieza` ahora es UNIQUE por empresa, no por
--      ingreso. Antes UNIQUE (ingreso_id, numero_pieza) permitía
--      repetir el mismo número en distintos ingresos. El user
--      escaneable del depósito requiere que cada número sea único
--      en toda la empresa.
--
-- Idempotente.
-- ============================================================


-- ── 1. Limpieza de datos transaccionales ────────────────────
-- CASCADE garantiza que cualquier referencia futura caiga sola.
-- RESTART IDENTITY no afecta UUIDs pero es seguro dejarlo.

TRUNCATE TABLE
  public.muestras,
  public.pedido_rollos,
  public.pedidos,
  public.rollos,
  public.ingresos
RESTART IDENTITY CASCADE;

-- pedidos_pendientes existe desde la 013. Si la migración 018
-- corre en una DB que todavía no aplicó la 013, este DELETE
-- silencioso lo cubre con EXCEPTION handler.
DO $$
BEGIN
  EXECUTE 'TRUNCATE TABLE public.pedidos_pendientes RESTART IDENTITY CASCADE';
EXCEPTION WHEN undefined_table THEN
  -- pedidos_pendientes no existe todavía, no hay nada que limpiar.
  NULL;
END $$;


-- ── 2. UNIQUE en empresas.nombre ────────────────────────────

ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_nombre_key;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_nombre_key UNIQUE (nombre);


-- ── 3. UNIQUE de numero_pieza por empresa ───────────────────
-- Reemplaza el UNIQUE viejo de (ingreso_id, numero_pieza).

ALTER TABLE public.rollos
  DROP CONSTRAINT IF EXISTS rollos_ingreso_id_numero_pieza_key;

ALTER TABLE public.rollos
  DROP CONSTRAINT IF EXISTS rollos_empresa_id_numero_pieza_key;

ALTER TABLE public.rollos
  ADD CONSTRAINT rollos_empresa_id_numero_pieza_key
  UNIQUE (empresa_id, numero_pieza);
