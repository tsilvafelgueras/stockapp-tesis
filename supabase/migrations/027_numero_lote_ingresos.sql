-- ============================================================
-- Migración 027 — Número de lote en ingresos
--
-- Cada ingreso = un lote. Se asigna automáticamente un código
-- con formato L-AAAA-NNN (ej: L-2026-042), secuencial por
-- empresa y reseteable cada año (basado en fecha_despacho).
--
-- Componentes:
--   1) Tabla lote_secuencias para generación atómica.
--   2) Columna numero_lote en ingresos + unicidad por empresa.
--   3) Trigger BEFORE INSERT que asigna el código si falta.
--   4) Backfill cronológico de ingresos existentes.
--
-- Idempotente.
-- ============================================================

-- 1) Tabla de secuencias
CREATE TABLE IF NOT EXISTS lote_secuencias (
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  anio          INT  NOT NULL,
  ultimo_numero INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, anio)
);

-- 2) Columna + unicidad por (empresa, numero_lote)
ALTER TABLE ingresos
  ADD COLUMN IF NOT EXISTS numero_lote TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ingresos_numero_lote_empresa_uniq
  ON ingresos (empresa_id, numero_lote)
  WHERE numero_lote IS NOT NULL;

-- 3) Trigger BEFORE INSERT
CREATE OR REPLACE FUNCTION trg_ingresos_numero_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS ingresos_numero_lote_trg ON ingresos;
CREATE TRIGGER ingresos_numero_lote_trg
  BEFORE INSERT ON ingresos
  FOR EACH ROW
  EXECUTE FUNCTION trg_ingresos_numero_lote();

-- 4) Backfill cronológico de ingresos existentes
DO $$
DECLARE
  r                   RECORD;
  v_contador          INT  := 0;
  v_anio_actual       INT  := -1;
  v_empresa_actual    UUID := NULL;
BEGIN
  FOR r IN
    SELECT id,
           empresa_id,
           EXTRACT(YEAR FROM COALESCE(fecha_despacho, created_at::DATE))::INT AS anio
      FROM ingresos
     WHERE numero_lote IS NULL
     ORDER BY empresa_id,
              COALESCE(fecha_despacho, created_at::DATE),
              created_at,
              id
  LOOP
    IF v_empresa_actual IS DISTINCT FROM r.empresa_id
       OR v_anio_actual <> r.anio THEN
      v_contador       := 0;
      v_empresa_actual := r.empresa_id;
      v_anio_actual    := r.anio;
    END IF;

    v_contador := v_contador + 1;

    UPDATE ingresos
       SET numero_lote = 'L-' || r.anio || '-' || LPAD(v_contador::TEXT, 3, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Sincronizar lote_secuencias con el máximo backfilleado por (empresa, año)
INSERT INTO lote_secuencias (empresa_id, anio, ultimo_numero)
SELECT
  empresa_id,
  EXTRACT(YEAR FROM COALESCE(fecha_despacho, created_at::DATE))::INT AS anio,
  MAX(
    CAST(
      SUBSTRING(
        numero_lote
        FROM LENGTH('L-' || EXTRACT(YEAR FROM COALESCE(fecha_despacho, created_at::DATE))::TEXT || '-') + 1
      ) AS INTEGER
    )
  ) AS ultimo_numero
  FROM ingresos
 WHERE numero_lote IS NOT NULL
 GROUP BY empresa_id, anio
ON CONFLICT (empresa_id, anio)
DO UPDATE SET ultimo_numero = GREATEST(lote_secuencias.ultimo_numero, EXCLUDED.ultimo_numero);
