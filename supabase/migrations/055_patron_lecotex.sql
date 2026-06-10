-- ============================================================
-- Migración 055 — Patrón de código de pieza para Lecotex
--
-- El QR de Lecotex trae el número de pieza seguido de artículo, color,
-- un código interno y el peso, ej:
--   "204024331 MORLEY POL C/LY NEGRO 9001 21.00"
-- El número de pieza es el PRIMER número del payload (204024331).
--
-- Cargamos un patrón regex específico de Lecotex (global a la tintorería:
-- empresa_id NULL, tintoreria_id = Lecotex) que captura ese primer número.
-- Así Lecotex pasa por el MISMO mecanismo por-tintorería que las demás
-- (`tintoreria_codigo_patrones`) en vez de depender del fallback genérico,
-- y NO afecta a ninguna otra tintorería.
--
-- (`(\d+)` con prioridad baja = se prueba primero; `extraerCodigoCandidato`
-- toma la primera coincidencia → el primer número del payload.)
--
-- Idempotente. Sin TRUNCATE.
-- ============================================================

INSERT INTO public.tintoreria_codigo_patrones (
  empresa_id, tintoreria_id, pattern, capture_group, prioridad, descripcion
)
SELECT
  NULL,
  'ab152e81-8804-4c0c-9aed-468fbbd1f705',
  '(\d+)',
  1,
  50,
  'Lecotex: el número de pieza es el primer número del payload del QR.'
WHERE NOT EXISTS (
  SELECT 1
    FROM public.tintoreria_codigo_patrones p
   WHERE p.tintoreria_id = 'ab152e81-8804-4c0c-9aed-468fbbd1f705'
     AND p.pattern = '(\d+)'
);
