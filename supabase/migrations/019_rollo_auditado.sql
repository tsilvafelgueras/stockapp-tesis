-- ============================================================
-- Migración 019 — Auditoría de rollos
--
-- Permite que operario o admin "audite" un rollo desde la pantalla
-- de stock: registra quién y cuándo lo verificó físicamente, sin
-- cambiar el estado del rollo. Sirve como contraparte ligera de
-- la confirmación manual (que sí cambia de pendiente a en_stock).
--
-- Solo se guarda la ÚLTIMA auditoría — el historial completo va a
-- vivir en la tabla `movimientos` cuando se implemente (Bloque F).
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS auditado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auditado_por UUID REFERENCES auth.users(id);
