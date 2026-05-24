-- ============================================================
-- Migración 030 — Fecha de baja de tintorerías
--
-- La fecha de alta ya está cubierta por `tintorerias.created_at`.
-- Agregamos `fecha_baja TIMESTAMPTZ NULL` para registrar cuándo
-- la empresa dejó de operar con esa tintorería, conservando el
-- registro histórico (rollos viejos siguen apuntando a la FK)
-- por si más adelante se reactiva la relación comercial.
--
-- Convención:
--   activo = true,  fecha_baja IS NULL     → operativa
--   activo = false, fecha_baja IS NOT NULL → dada de baja
--
-- El estado lo siguen manejando los actions; esta migración solo
-- expone la columna.
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.tintorerias
  ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMPTZ NULL;

-- Backfill: tintorerías que ya estaban inactivas pero sin fecha_baja
-- toman el created_at como aproximación (mejor que NULL para la UI).
UPDATE public.tintorerias
   SET fecha_baja = created_at
 WHERE activo = FALSE
   AND fecha_baja IS NULL;
