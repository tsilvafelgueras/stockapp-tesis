-- ============================================================
-- Migración 002 — Agregar despachos.origen
--
-- Diferencia entre despachos cargados manualmente vs
-- los que se cargaron desde una planilla via IA.
-- ============================================================

ALTER TABLE despachos
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'planilla_ia'));
