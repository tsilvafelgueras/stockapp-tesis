-- ============================================================
-- Migración 036 — Color por rollo
--
-- Mueve la responsabilidad de "color" del header del ingreso a cada
-- rollo. Realidad operativa: una planilla puede tener varios colores
-- distintos entre sus rollos (igual que ya pasa con `articulo_id`,
-- que ya vive en `rollos`). El campo `ingresos.color` queda
-- deprecated — sin uso desde los formularios nuevos — y se sacará en
-- una migración futura cuando se confirme que ningún consumer lo
-- lee.
--
-- Idempotente.
-- ============================================================

-- ── 1. Nueva columna en rollos ─────────────────────────────

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS color TEXT NULL;

-- ── 2. Backfill desde ingresos.color ───────────────────────
-- Cada rollo hereda el color del ingreso al que pertenece, si no
-- tiene uno propio todavía. Esto mantiene los datos consistentes
-- para los rollos viejos.

UPDATE public.rollos r
   SET color = i.color
  FROM public.ingresos i
 WHERE r.ingreso_id = i.id
   AND r.color IS NULL
   AND i.color IS NOT NULL;
