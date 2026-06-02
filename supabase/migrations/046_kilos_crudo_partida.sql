-- ============================================================
-- Migración 046 — Kilos de crudo por partida (merma real)
--
-- Habilita el cálculo de merma real del proceso de teñido:
-- cuántos kilos de crudo salieron a teñir vs cuántos kilos
-- teñidos volvieron (suma de los rollos del ingreso).
--
-- Se carga UN total por partida (no rollo por rollo), porque el
-- crudo se pesa por el total del lote antes de mandarlo a teñir.
--
-- Idempotente. Sin TRUNCATE.
-- ============================================================

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS kilos_crudo_enviado    NUMERIC,
  ADD COLUMN IF NOT EXISTS kilos_crudo_cargado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kilos_crudo_cargado_por UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.ingresos.kilos_crudo_enviado IS
  'Kilos totales de crudo que salieron a teñir para esta partida. Se compara con la suma de kilos teñidos recibidos (rollos) para calcular la merma.';
