-- Migración 024: Notificaciones in-app
-- Idempotente.
--
-- Modelo: tabla `notificaciones` genérica (campo `tipo` permite agregar más
-- categorías en el futuro). Para la primera iteración se implementa el tipo
-- `stock_minimo` que se dispara automáticamente vía triggers en `rollos` y
-- `articulos`.
--
-- Semántica:
--   - INSERT cuando el stock kg de un artículo (sumando rollos en_stock) cae
--     por debajo de `articulos.stock_minimo_kg`. Dedupe vía UNIQUE parcial
--     sobre (empresa, tipo, articulo) WHERE resuelta_at IS NULL → no spamea.
--   - UPDATE resuelta_at = NOW() cuando el stock vuelve a subir sobre el
--     mínimo → la alerta desaparece del badge sin acción manual.
--   - `leida_at` lo setea el admin/ventas desde la UI (independiente de
--     resuelta_at: una alerta puede ser leída pero seguir activa).
--
-- RLS: visible para admin + ventas de la empresa. Operario no las ve (no es
-- su problema). El INSERT/UPDATE de filas lo hacen exclusivamente los
-- triggers (SECURITY DEFINER); no se exponen policies de INSERT.

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('stock_minimo')),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  articulo_id UUID NULL REFERENCES articulos(id) ON DELETE CASCADE,
  leida_at TIMESTAMPTZ NULL,
  resuelta_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_empresa_activas
  ON notificaciones (empresa_id, created_at DESC)
  WHERE resuelta_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_activa_por_tipo_articulo
  ON notificaciones (empresa_id, tipo, articulo_id)
  WHERE resuelta_at IS NULL;

-- Trigger que setea empresa_id automáticamente (helper de migración 005).
DROP TRIGGER IF EXISTS set_empresa_id_notificaciones ON notificaciones;
CREATE TRIGGER set_empresa_id_notificaciones
  BEFORE INSERT ON notificaciones
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select_admin_ventas ON notificaciones;
CREATE POLICY notificaciones_select_admin_ventas ON notificaciones
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('admin', 'ventas')
    )
  );

DROP POLICY IF EXISTS notificaciones_update_admin_ventas ON notificaciones;
CREATE POLICY notificaciones_update_admin_ventas ON notificaciones
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('admin', 'ventas')
    )
  );

-- Helper SECURITY DEFINER: dado un articulo_id, evalúa si su stock está bajo
-- el mínimo y crea/resuelve la notificación en consecuencia. Lo llaman los
-- triggers de rollos y articulos.
CREATE OR REPLACE FUNCTION procesar_notificacion_stock_minimo(p_articulo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_nombre TEXT;
  v_minimo NUMERIC;
  v_stock_actual NUMERIC;
BEGIN
  SELECT empresa_id, nombre, stock_minimo_kg
    INTO v_empresa_id, v_nombre, v_minimo
    FROM articulos
   WHERE id = p_articulo_id;

  IF v_empresa_id IS NULL OR v_minimo IS NULL THEN
    -- Sin mínimo configurado: nada que notificar. Pero por si quedó una
    -- notificación vieja (mínimo removido), resolverla.
    UPDATE notificaciones
       SET resuelta_at = NOW()
     WHERE articulo_id = p_articulo_id
       AND tipo = 'stock_minimo'
       AND resuelta_at IS NULL;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(kilos), 0)
    INTO v_stock_actual
    FROM rollos
   WHERE articulo_id = p_articulo_id
     AND estado = 'en_stock';

  IF v_stock_actual < v_minimo THEN
    INSERT INTO notificaciones (empresa_id, tipo, titulo, mensaje, articulo_id)
    VALUES (
      v_empresa_id,
      'stock_minimo',
      'Stock bajo el mínimo',
      v_nombre || ' está en ' || ROUND(v_stock_actual, 2)::TEXT
        || ' kg (mínimo configurado: ' || ROUND(v_minimo, 2)::TEXT || ' kg). '
        || 'Considerá pedir reposición.',
      p_articulo_id
    )
    ON CONFLICT (empresa_id, tipo, articulo_id) WHERE resuelta_at IS NULL
    DO NOTHING;
  ELSE
    UPDATE notificaciones
       SET resuelta_at = NOW()
     WHERE empresa_id = v_empresa_id
       AND tipo = 'stock_minimo'
       AND articulo_id = p_articulo_id
       AND resuelta_at IS NULL;
  END IF;
END;
$$;

-- Trigger en rollos: reevaluar el artículo cuando cambia kilos/estado/articulo.
CREATE OR REPLACE FUNCTION trg_stock_minimo_rollos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.articulo_id IS NOT NULL THEN
      PERFORM procesar_notificacion_stock_minimo(OLD.articulo_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.articulo_id IS NOT NULL THEN
    PERFORM procesar_notificacion_stock_minimo(NEW.articulo_id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.articulo_id IS DISTINCT FROM NEW.articulo_id
     AND OLD.articulo_id IS NOT NULL
  THEN
    PERFORM procesar_notificacion_stock_minimo(OLD.articulo_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_minimo_check_rollos ON rollos;
CREATE TRIGGER stock_minimo_check_rollos
  AFTER INSERT OR UPDATE OF kilos, estado, articulo_id OR DELETE ON rollos
  FOR EACH ROW EXECUTE FUNCTION trg_stock_minimo_rollos();

-- Trigger en articulos: cuando se cambia el stock_minimo_kg, reevaluar.
CREATE OR REPLACE FUNCTION trg_stock_minimo_articulos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.stock_minimo_kg IS DISTINCT FROM NEW.stock_minimo_kg THEN
    PERFORM procesar_notificacion_stock_minimo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_minimo_check_articulos ON articulos;
CREATE TRIGGER stock_minimo_check_articulos
  AFTER UPDATE OF stock_minimo_kg ON articulos
  FOR EACH ROW EXECUTE FUNCTION trg_stock_minimo_articulos();

-- Sembrar: revisar TODOS los articulos con minimo definido para crear las
-- notificaciones que correspondan al estado actual del stock.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM articulos WHERE stock_minimo_kg IS NOT NULL LOOP
    PERFORM procesar_notificacion_stock_minimo(rec.id);
  END LOOP;
END $$;
