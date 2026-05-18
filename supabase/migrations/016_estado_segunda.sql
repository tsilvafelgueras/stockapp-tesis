-- Migración 016: estado "segunda" en rollos (mercadería de segunda calidad)
--
-- Permite marcar rollos con defectos visibles o calidad inferior sin
-- darlos completamente de baja. Los rollos en "segunda" siguen en stock
-- pero se muestran separados y se pueden vender/procesar diferenciados.

ALTER TABLE public.rollos
  DROP CONSTRAINT IF EXISTS rollos_estado_check;

ALTER TABLE public.rollos
  ADD CONSTRAINT rollos_estado_check
  CHECK (estado IN ('pendiente', 'en_stock', 'reservado', 'entregado', 'baja', 'segunda'));
