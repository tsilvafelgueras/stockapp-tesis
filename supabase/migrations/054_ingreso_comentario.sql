-- ============================================================
-- Migración 054 — Comentario libre por ingreso/partida
--
-- Permite agregar un comentario al crear el ingreso (ej. "faltó un rollo,
-- se reclama a la tintorería"), que después se puede editar o borrar desde
-- el detalle del ingreso. Es a nivel partida (header), distinto de
-- `conteo_nota` (que documenta la discrepancia del conteo al confirmar) y de
-- `rollos.comentario` (puntual por rollo).
--
-- Idempotente. Sin TRUNCATE.
-- ============================================================

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS comentario TEXT;

COMMENT ON COLUMN public.ingresos.comentario IS
  'Comentario libre de la partida, editable/borrable desde el detalle del ingreso.';
