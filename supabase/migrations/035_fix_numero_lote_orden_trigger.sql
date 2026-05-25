-- ============================================================
-- Migración 035 — Fix orden de triggers en INSERT a ingresos
--
-- La tabla `ingresos` tiene dos triggers BEFORE INSERT:
--   1) `ingresos_numero_lote_trg` (mig. 027) — rellena numero_lote
--      y crea fila en lote_secuencias usando NEW.empresa_id.
--   2) `set_empresa_ingresos` (mig. 005) — rellena NEW.empresa_id
--      con current_empresa_id().
--
-- Postgres ejecuta triggers BEFORE en orden alfabético del NOMBRE
-- del trigger. "ingresos_numero_lote_trg" < "set_empresa_ingresos",
-- así que el de lote corre PRIMERO, cuando NEW.empresa_id todavía
-- es NULL. El INSERT a lote_secuencias entonces falla con:
--
--   null value in column "empresa_id" of relation "lote_secuencias"
--   violates not-null constraint
--
-- Solución: que el trigger de lote resuelva empresa_id por sí
-- mismo (igual que hace set_empresa_id), tomando current_empresa_id()
-- cuando NEW.empresa_id no viene seteado. Además seteamos
-- NEW.empresa_id en el mismo trigger para que el otro no lo cambie
-- después (set_empresa_id solo escribe si está NULL).
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
  v_anio       INT;
  v_proximo    INT;
  v_empresa_id UUID;
BEGIN
  -- Si ya viene con número (backfill o asignación manual), respetarlo
  IF NEW.numero_lote IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver empresa_id sin depender del orden de triggers
  v_empresa_id := COALESCE(NEW.empresa_id, public.current_empresa_id());
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION
      'No se pudo determinar empresa_id para generar el número de lote.';
  END IF;

  -- Sembramos NEW.empresa_id para que set_empresa_id (que corre después)
  -- no lo cambie con otro valor. set_empresa_id solo escribe si está NULL,
  -- así que setearlo acá es seguro.
  NEW.empresa_id := v_empresa_id;

  v_anio := EXTRACT(YEAR FROM COALESCE(NEW.fecha_despacho, CURRENT_DATE))::INT;

  INSERT INTO lote_secuencias (empresa_id, anio, ultimo_numero)
    VALUES (v_empresa_id, v_anio, 1)
    ON CONFLICT (empresa_id, anio)
    DO UPDATE SET ultimo_numero = lote_secuencias.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_proximo;

  NEW.numero_lote := 'L-' || v_anio || '-' || LPAD(v_proximo::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
