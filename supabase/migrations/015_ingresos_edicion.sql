-- Migración 015: campos de auditoría de edición en ingresos
--
-- Permite registrar quién y cuándo editó el encabezado de un ingreso.
-- No guarda historial completo; solo la última edición (simple y suficiente
-- para el flujo actual de la empresa).

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS editado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS editado_por UUID REFERENCES auth.users(id);
