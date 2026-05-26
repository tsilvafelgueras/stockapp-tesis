-- ============================================================
-- Migración 031 — Fix RLS en trigger de numero_lote
--
-- La función `trg_ingresos_numero_lote()` (migración 027) inserta
-- en `lote_secuencias` para reservar el siguiente número de lote.
-- Como estaba declarada con SECURITY INVOKER (default), corría
-- con los permisos del usuario que insertaba en `ingresos`. Si
-- ese usuario no tiene permiso de INSERT/UPDATE sobre
-- `lote_secuencias` (RLS sin policies), el INSERT al ingreso
-- fallaba con:
--
--   new row violates row-level security policy for table "lote_secuencias"
--
-- `lote_secuencias` es una tabla interna de control de secuencias,
-- no se expone directamente a los users. La función debe correr
-- con SECURITY DEFINER para tener acceso garantizado, y fijamos
-- search_path por seguridad (es el patrón que ya usan otras
-- funciones definer del proyecto, ej. crear_pedido).
--
-- Idempotente: CREATE OR REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_ingresos_numero_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anio    INT;
  v_proximo INT;
BEGIN
  -- Si ya viene con número (ej. backfill o asignación manual), respetarlo
  IF NEW.numero_lote IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_anio := EXTRACT(YEAR FROM COALESCE(NEW.fecha_despacho, CURRENT_DATE))::INT;

  INSERT INTO lote_secuencias (empresa_id, anio, ultimo_numero)
    VALUES (NEW.empresa_id, v_anio, 1)
    ON CONFLICT (empresa_id, anio)
    DO UPDATE SET ultimo_numero = lote_secuencias.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_proximo;

  NEW.numero_lote := 'L-' || v_anio || '-' || LPAD(v_proximo::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
