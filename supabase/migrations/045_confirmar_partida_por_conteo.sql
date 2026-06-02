-- ============================================================
-- Migración 045 — Confirmar partida por conteo
--
-- Cambia el flujo de confirmación física de llegadas. Antes el
-- operario escaneaba el QR de cada rollo uno por uno; ahora
-- cuenta físicamente cuántos rollos hay e ingresa ese número.
-- El sistema valida el conteo contra la planilla y, si coincide,
-- confirma toda la partida de una.
--
-- Columnas nuevas:
--   1) `rollos.comentario`       TEXT — comentario libre por rollo
--      (detalle puntual que el operario quiera dejar de un rollo).
--   2) `ingresos.conteo_fisico`  INT  — cuántos rollos contó el
--      operario al confirmar la llegada.
--   3) `ingresos.conteo_nota`    TEXT — nota de la discrepancia
--      cuando el conteo no coincide con la planilla y el operario
--      confirma igual (queda como traza para reclamar a la
--      tintorería).
--
-- Los triggers de auditoría (mig 021, tabla `movimientos`) ya
-- capturan los UPDATE de `rollos` e `ingresos` en JSONB, así que
-- la confirmación queda registrada automáticamente.
--
-- Idempotente.
-- ============================================================


-- ── 1. Comentario por rollo ─────────────────────────────────

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS comentario TEXT NULL;


-- ── 2. Conteo físico + nota de discrepancia en ingresos ─────

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS conteo_fisico INT NULL;

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS conteo_nota TEXT NULL;
