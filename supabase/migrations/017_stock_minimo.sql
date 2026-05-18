-- Migración 017: stock mínimo configurable por artículo
--
-- Permite que el admin fije un mínimo de kg en stock por artículo.
-- Cuando el stock real cae por debajo, el dashboard muestra una alerta.

ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS stock_minimo_kg NUMERIC;
