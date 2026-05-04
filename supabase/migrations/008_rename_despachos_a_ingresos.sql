-- ============================================================
-- Migración 008 — Rename despachos → ingresos + config por tintorería
--
-- Cambios:
--   1. Renombrar la tabla `despachos` a `ingresos`. La palabra "despacho"
--      se confunde con "despacho a cliente" (que en el schema es `pedidos`).
--      "Ingreso" es lo que recibimos de la tintorería en nuestro depósito.
--      Las RLS policies y triggers siguen funcionando porque referencian
--      la tabla por OID, no por nombre. Solo los nombres cosméticos quedan
--      con "despachos" — eso no afecta funcionalidad.
--
--   2. Agregar `extraction_config_key TEXT NULL` en `tintorerias`. Nosotros
--      (los devs/super-admins de la plataforma) lo seteamos vía SQL cuando
--      damos de alta una tintorería con formato de planilla específico. Si
--      es NULL, la IA usa el prompt genérico (default).
--
-- Idempotente.
-- ============================================================

-- 1. Rename de tabla (PostgreSQL preserva FKs y RLS automáticamente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'despachos'
  ) THEN
    ALTER TABLE despachos RENAME TO ingresos;
  END IF;
END $$;

-- 2. Renombrar la FK column en `rollos` (`despacho_id` → `ingreso_id`)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rollos'
      AND column_name = 'despacho_id'
  ) THEN
    ALTER TABLE rollos RENAME COLUMN despacho_id TO ingreso_id;
  END IF;
END $$;

-- 3. El UNIQUE constraint (despacho_id, numero_pieza) queda con nombre
--    viejo pero funciona. Lo renombramos por prolijidad.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'public.rollos'::regclass
     AND contype = 'u'
     AND conname LIKE '%despacho%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE rollos RENAME CONSTRAINT %I TO rollos_ingreso_id_numero_pieza_key', cname);
  END IF;
END $$;

-- 4. Agregar config key en tintorerias
ALTER TABLE tintorerias
  ADD COLUMN IF NOT EXISTS extraction_config_key TEXT;

-- Opcional: comentario explicativo en la columna
COMMENT ON COLUMN tintorerias.extraction_config_key IS
  'Clave que matchea con un archivo en src/lib/extraccion/tintorerias/{key}.ts. Si NULL, se usa el prompt default. Lo setean los devs vía SQL cuando dan de alta una tintorería con formato específico.';
