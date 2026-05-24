-- ============================================================
-- Migración 028 — Catálogo de colores
--
-- Hoy ingresos.color es texto libre y permite duplicados por
-- casing/espacios ("BLANCO", "blanco", "Blanco" cuentan como
-- 3 colores distintos en el filtro de stock).
--
-- Creamos una tabla catálogo `colores` (mismo patrón que
-- tintorerias) y normalizamos los valores existentes a Title
-- Case con INITCAP. ingresos.color sigue siendo TEXT (no FK)
-- para no tocar código de queries existentes; lo que se guarda
-- es el nombre canónico del color.
--
-- Idempotente.
-- ============================================================

-- 1) Tabla colores
CREATE TABLE IF NOT EXISTS colores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  nombre      TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);

ALTER TABLE colores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen colores de su empresa" ON colores;
CREATE POLICY "Autenticados leen colores de su empresa"
  ON colores FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan colores" ON colores;
CREATE POLICY "Operario y admin gestionan colores"
  ON colores FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_colores ON colores;
CREATE TRIGGER set_empresa_colores BEFORE INSERT ON colores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- 2) Backfill: normalizar ingresos.color a Title Case y poblar catálogo
--    INITCAP convierte cada palabra a Capitalized: 'AZUL MARINO' → 'Azul Marino'

-- 2.a) Normalizar valores existentes en ingresos
UPDATE ingresos
   SET color = INITCAP(LOWER(TRIM(color)))
 WHERE color IS NOT NULL
   AND TRIM(color) <> ''
   AND color <> INITCAP(LOWER(TRIM(color)));

-- 2.b) Insertar cada color único en el catálogo por empresa.
--      Bypass del trigger set_empresa_colores: como ya pasamos empresa_id
--      explícito, el trigger respeta el valor si NEW.empresa_id IS NOT NULL.
INSERT INTO colores (empresa_id, nombre)
SELECT DISTINCT i.empresa_id, i.color
  FROM ingresos i
 WHERE i.color IS NOT NULL
   AND TRIM(i.color) <> ''
ON CONFLICT (empresa_id, nombre) DO NOTHING;
