-- ============================================================
-- Migracion 041 - Prioridad profesional en demandas
--
-- Cubre bases donde la migracion 040 anterior ya hubiera creado
-- urgencia/fecha_limite, migrando esos datos al modelo nuevo:
-- prioridad + fecha_requerida.
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.pedidos_pendientes
  ADD COLUMN IF NOT EXISTS prioridad TEXT,
  ADD COLUMN IF NOT EXISTS fecha_requerida DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos_pendientes'
       AND column_name = 'urgencia'
  ) THEN
    EXECUTE $sql$
      UPDATE public.pedidos_pendientes
         SET prioridad = CASE
           WHEN urgencia = 'urgente' THEN 'critica'
           WHEN urgencia = 'fecha_especifica' THEN 'programada'
           WHEN urgencia = 'sin_apuro' THEN 'flexible'
           ELSE COALESCE(prioridad, 'flexible')
         END
       WHERE prioridad IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos_pendientes'
       AND column_name = 'fecha_limite'
  ) THEN
    EXECUTE $sql$
      UPDATE public.pedidos_pendientes
         SET fecha_requerida = fecha_limite
       WHERE fecha_requerida IS NULL
         AND fecha_limite IS NOT NULL
    $sql$;
  END IF;
END $$;

UPDATE public.pedidos_pendientes
   SET prioridad = COALESCE(prioridad, 'flexible')
 WHERE prioridad IS NULL;

UPDATE public.pedidos_pendientes
   SET prioridad = 'flexible'
 WHERE prioridad NOT IN ('critica', 'alta', 'programada', 'flexible');

ALTER TABLE public.pedidos_pendientes
  ALTER COLUMN prioridad SET DEFAULT 'flexible',
  ALTER COLUMN prioridad SET NOT NULL;

ALTER TABLE public.pedidos_pendientes
  DROP CONSTRAINT IF EXISTS pedidos_pendientes_urgencia_check;
ALTER TABLE public.pedidos_pendientes
  DROP CONSTRAINT IF EXISTS pedidos_pendientes_prioridad_check;
ALTER TABLE public.pedidos_pendientes
  ADD CONSTRAINT pedidos_pendientes_prioridad_check
  CHECK (prioridad IN ('critica', 'alta', 'programada', 'flexible'));

DROP INDEX IF EXISTS public.pedidos_pendientes_fecha_limite_idx;

CREATE INDEX IF NOT EXISTS pedidos_pendientes_fecha_requerida_idx
  ON public.pedidos_pendientes (empresa_id, fecha_requerida)
  WHERE estado = 'activo';

ALTER TABLE public.pedidos_pendientes
  DROP COLUMN IF EXISTS urgencia,
  DROP COLUMN IF EXISTS fecha_limite;
