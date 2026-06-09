-- ============================================================
-- Migración 053 — Colores fijados (pin) por artículo
--
-- Permite "fijar" colores dentro de un artículo para que aparezcan
-- arriba de todo en la lista desplegable de colores de ese artículo
-- (form de artículo y selección de color al cargar rollos).
--
-- Cada artículo puede tener distintos colores fijados; se pueden fijar
-- cuantos se quiera. El orden resultante es: fijados primero (alfabético),
-- luego el resto (alfabético).
--
-- Idempotente. Sin TRUNCATE.
-- ============================================================

ALTER TABLE public.articulo_colores
  ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.articulo_colores.fijado IS
  'Si TRUE, este color aparece arriba en la lista de colores del artículo (pin). Por artículo.';
