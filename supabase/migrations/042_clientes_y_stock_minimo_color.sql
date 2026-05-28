-- ============================================================
-- Migracion 042 - Ajustes comerciales y stock minimo por color
--
-- 1) CUIT/CUIL solo numerico cuando esta informado.
-- 2) Stock minimo configurable por combinacion articulo/color.
-- 3) Notificaciones de stock minimo evaluadas por articulo/color.
--
-- Idempotente.
-- ============================================================

UPDATE public.clientes
   SET cuit_cuil = NULLIF(regexp_replace(cuit_cuil, '\D', '', 'g'), '')
 WHERE cuit_cuil IS NOT NULL;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_cuit_cuil_numeric_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_cuit_cuil_numeric_check
  CHECK (cuit_cuil IS NULL OR cuit_cuil ~ '^[0-9]+$');

ALTER TABLE public.articulo_colores
  ADD COLUMN IF NOT EXISTS stock_minimo_kg NUMERIC;

UPDATE public.articulo_colores ac
   SET stock_minimo_kg = a.stock_minimo_kg
  FROM public.articulos a
 WHERE ac.articulo_id = a.id
   AND ac.stock_minimo_kg IS NULL
   AND a.stock_minimo_kg IS NOT NULL;

CREATE INDEX IF NOT EXISTS articulo_colores_stock_minimo_idx
  ON public.articulo_colores (empresa_id, articulo_id, color_id)
  WHERE stock_minimo_kg IS NOT NULL;

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.colores(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.uq_notificaciones_activa_por_tipo_articulo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_activa_por_tipo_articulo_color
  ON public.notificaciones (empresa_id, tipo, articulo_id, color_id)
  WHERE resuelta_at IS NULL;

DROP FUNCTION IF EXISTS public.procesar_notificacion_stock_minimo(UUID);

CREATE OR REPLACE FUNCTION public.procesar_notificacion_stock_minimo(
  p_articulo_id UUID,
  p_color_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_articulo TEXT;
  v_color TEXT;
  v_minimo NUMERIC;
  v_stock_actual NUMERIC;
BEGIN
  SELECT ac.empresa_id, a.nombre, c.nombre, ac.stock_minimo_kg
    INTO v_empresa_id, v_articulo, v_color, v_minimo
    FROM articulo_colores ac
    JOIN articulos a ON a.id = ac.articulo_id
    JOIN colores c ON c.id = ac.color_id
   WHERE ac.articulo_id = p_articulo_id
     AND ac.color_id = p_color_id;

  IF v_empresa_id IS NULL OR v_minimo IS NULL THEN
    UPDATE notificaciones
       SET resuelta_at = NOW()
     WHERE articulo_id = p_articulo_id
       AND color_id = p_color_id
       AND tipo = 'stock_minimo'
       AND resuelta_at IS NULL;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(kilos), 0)
    INTO v_stock_actual
    FROM rollos
   WHERE articulo_id = p_articulo_id
     AND color_id = p_color_id
     AND estado = 'en_stock';

  IF v_stock_actual < v_minimo THEN
    INSERT INTO notificaciones (
      empresa_id,
      tipo,
      titulo,
      mensaje,
      articulo_id,
      color_id
    )
    VALUES (
      v_empresa_id,
      'stock_minimo',
      'Stock bajo el minimo',
      v_articulo || ' - ' || v_color || ' esta en '
        || ROUND(v_stock_actual, 2)::TEXT
        || ' kg (minimo configurado: ' || ROUND(v_minimo, 2)::TEXT || ' kg). '
        || 'Considera pedir reposicion.',
      p_articulo_id,
      p_color_id
    )
    ON CONFLICT (empresa_id, tipo, articulo_id, color_id)
      WHERE resuelta_at IS NULL
    DO NOTHING;
  ELSE
    UPDATE notificaciones
       SET resuelta_at = NOW()
     WHERE empresa_id = v_empresa_id
       AND tipo = 'stock_minimo'
       AND articulo_id = p_articulo_id
       AND color_id = p_color_id
       AND resuelta_at IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_stock_minimo_rollos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.articulo_id IS NOT NULL AND OLD.color_id IS NOT NULL THEN
      PERFORM procesar_notificacion_stock_minimo(OLD.articulo_id, OLD.color_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.articulo_id IS NOT NULL AND NEW.color_id IS NOT NULL THEN
    PERFORM procesar_notificacion_stock_minimo(NEW.articulo_id, NEW.color_id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       OLD.articulo_id IS DISTINCT FROM NEW.articulo_id
       OR OLD.color_id IS DISTINCT FROM NEW.color_id
     )
     AND OLD.articulo_id IS NOT NULL
     AND OLD.color_id IS NOT NULL
  THEN
    PERFORM procesar_notificacion_stock_minimo(OLD.articulo_id, OLD.color_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_minimo_check_rollos ON public.rollos;
CREATE TRIGGER stock_minimo_check_rollos
  AFTER INSERT OR UPDATE OF kilos, estado, articulo_id, color_id OR DELETE
  ON public.rollos
  FOR EACH ROW EXECUTE FUNCTION public.trg_stock_minimo_rollos();

DROP TRIGGER IF EXISTS stock_minimo_check_articulos ON public.articulos;
DROP FUNCTION IF EXISTS public.trg_stock_minimo_articulos();

CREATE OR REPLACE FUNCTION public.trg_stock_minimo_articulo_colores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM procesar_notificacion_stock_minimo(OLD.articulo_id, OLD.color_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM procesar_notificacion_stock_minimo(NEW.articulo_id, NEW.color_id);
    RETURN NEW;
  END IF;

  IF OLD.stock_minimo_kg IS DISTINCT FROM NEW.stock_minimo_kg THEN
    PERFORM procesar_notificacion_stock_minimo(NEW.articulo_id, NEW.color_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_minimo_check_articulo_colores ON public.articulo_colores;
CREATE TRIGGER stock_minimo_check_articulo_colores
  AFTER INSERT OR UPDATE OF stock_minimo_kg OR DELETE
  ON public.articulo_colores
  FOR EACH ROW EXECUTE FUNCTION public.trg_stock_minimo_articulo_colores();

DO $$
DECLARE
  rec RECORD;
BEGIN
  UPDATE notificaciones
     SET resuelta_at = NOW()
   WHERE tipo = 'stock_minimo'
     AND color_id IS NULL
     AND resuelta_at IS NULL;

  FOR rec IN
    SELECT articulo_id, color_id
      FROM articulo_colores
     WHERE stock_minimo_kg IS NOT NULL
  LOOP
    PERFORM procesar_notificacion_stock_minimo(rec.articulo_id, rec.color_id);
  END LOOP;
END $$;
