-- ============================================================
-- Migración 032 — Datos de contacto de tintorerías
--
-- Sumamos 3 columnas opcionales para que el admin guarde a quién
-- llamar/escribir cuando hay que coordinar con la tintorería:
--   - contacto: nombre del referente
--   - email:    correo de contacto
--   - telefono: teléfono (texto, no se valida formato)
--
-- Mismo patrón que la tabla `clientes` (migración 022).
-- Las 3 columnas son nullables — la mayoría de las tintorerías
-- existentes no tienen estos datos cargados.
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.tintorerias
  ADD COLUMN IF NOT EXISTS contacto TEXT,
  ADD COLUMN IF NOT EXISTS email    TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT;
