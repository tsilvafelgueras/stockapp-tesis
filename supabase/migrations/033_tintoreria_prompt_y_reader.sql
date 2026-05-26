-- ============================================================
-- Migración 033 — Prompt de extracción y tipo de lector por tintorería
--
-- Cambios:
--
-- 1. Reemplazamos `extraction_config_key` (que apuntaba a un archivo
--    en src/lib/extraccion/tintorerias/{key}.ts) por un campo TEXT libre
--    `extraction_prompt` que vive directamente en la DB. Lo edita el
--    superadmin desde /super/tintorerias. Las tintorerías de prueba que
--    tenían `extraction_config_key = 'muter-textil'` pierden el prompt
--    custom y caen al prompt default (son de prueba — ok).
--
-- 2. Agregamos `reader_type TEXT CHECK IN ('qr', 'barcode')` para que
--    el lector en /confirmar y /picking se renderice con la librería
--    específica (html5-qrcode o @zxing/browser) en lugar del lector
--    unificado actual. NULL = sin configurar → lector unificado fallback.
--
-- 3. Actualizamos la policy de tintorerías para que el superadmin pueda
--    INSERT/UPDATE/DELETE cross-empresa (hoy "Admin gestiona tintorerias"
--    solo permite admin de empresa local).
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.tintorerias
  ADD COLUMN IF NOT EXISTS extraction_prompt TEXT,
  ADD COLUMN IF NOT EXISTS reader_type TEXT
    CHECK (reader_type IN ('qr', 'barcode'));

ALTER TABLE public.tintorerias
  DROP COLUMN IF EXISTS extraction_config_key;

COMMENT ON COLUMN public.tintorerias.extraction_prompt IS
  'Prompt custom que el superadmin pega para guiar la extracción de planillas con IA. NULL = prompt default genérico.';

COMMENT ON COLUMN public.tintorerias.reader_type IS
  'Tipo de lector para escanear códigos de rollos: qr (html5-qrcode), barcode (@zxing/browser). NULL = lector unificado fallback.';

-- Policy: superadmin puede gestionar tintorerías cross-empresa.
DROP POLICY IF EXISTS "Admin gestiona tintorerias" ON public.tintorerias;
CREATE POLICY "Admin o super gestiona tintorerias"
  ON public.tintorerias FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );
