-- Migración 025: Agregar columna `color` a articulos.
-- Idempotente.
--
-- Modelo: cada artículo puede tener un color "principal" asociado (ej:
-- "Lycra ML40 Negro"). Es opcional (NULL si el artículo no tiene un color
-- intrínseco). No reemplaza a `ingresos.color` — un ingreso concreto puede
-- traer otro color del mismo artículo.
--
-- Normalización: la responsabilidad del sentence case (TRIM + primera
-- letra mayúscula, resto minúscula) la maneja la app (server actions de
-- `/admin/articulos`). Esta migración solo agrega la columna.

ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS color TEXT NULL;
