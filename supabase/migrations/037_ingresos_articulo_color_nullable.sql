-- ============================================================
-- Migración 037 — `ingresos.articulo_id` e `ingresos.color` nullable
--
-- Cierra la deuda dejada por migración 036: cuando se movió la
-- responsabilidad de `articulo_id` y `color` del header del ingreso
-- a cada rollo, se actualizó el código (actions.ts ya no los manda)
-- pero la DB quedó con NOT NULL, rompiendo todo INSERT nuevo:
--
--   null value in column "articulo_id" of relation "ingresos"
--   violates not-null constraint
--
-- Las columnas se conservan por ahora (las leen reportes, auditoría
-- y código viejo). Se eliminarán en una migración futura cuando se
-- confirme que ningún consumer las usa.
--
-- Idempotente: DROP NOT NULL no falla si ya es nullable.
-- ============================================================

ALTER TABLE public.ingresos
  ALTER COLUMN articulo_id DROP NOT NULL;

ALTER TABLE public.ingresos
  ALTER COLUMN color DROP NOT NULL;
