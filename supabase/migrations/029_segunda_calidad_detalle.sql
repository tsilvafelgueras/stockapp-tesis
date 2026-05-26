-- ============================================================
-- Migración 029 — Detalle de segunda calidad
--
-- Hoy un rollo se marca como 'segunda' sin capturar nada más.
-- El cliente de segunda pide saber qué falla es y ver fotos,
-- así que sumamos:
--   1) `rollos.falla_categoria` TEXT enumerado
--   2) `rollos.falla_descripcion` TEXT libre
--   3) Tabla `rollo_fotos` con N fotos por rollo (path en bucket
--      `planillas`, descripción opcional, tipo 'falla'|'general')
--
-- Las fotos se guardan en el bucket `planillas` ya existente
-- (reusa la RLS que aísla por empresa_id en el primer folder).
--
-- Idempotente.
-- ============================================================


-- ── 1. Columnas en rollos ───────────────────────────────────

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS falla_categoria  TEXT NULL;

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS falla_descripcion TEXT NULL;

ALTER TABLE public.rollos
  DROP CONSTRAINT IF EXISTS rollos_falla_categoria_check;

ALTER TABLE public.rollos
  ADD CONSTRAINT rollos_falla_categoria_check
  CHECK (
    falla_categoria IS NULL
    OR falla_categoria IN (
      'mancha',
      'agujero',
      'color_disparejo',
      'tono_diferente',
      'rotura_tejido',
      'otro'
    )
  );


-- ── 2. Tabla rollo_fotos ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rollo_fotos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  rollo_id    UUID NOT NULL REFERENCES rollos(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  descripcion TEXT,
  tipo        TEXT NOT NULL DEFAULT 'falla'
                CHECK (tipo IN ('falla', 'general')),
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rollo_fotos_rollo_id_idx
  ON public.rollo_fotos (rollo_id, created_at);

CREATE INDEX IF NOT EXISTS rollo_fotos_empresa_idx
  ON public.rollo_fotos (empresa_id);

ALTER TABLE public.rollo_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen rollo_fotos de su empresa"
  ON public.rollo_fotos;
CREATE POLICY "Autenticados leen rollo_fotos de su empresa"
  ON public.rollo_fotos FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Operario y admin gestionan rollo_fotos"
  ON public.rollo_fotos;
CREATE POLICY "Operario y admin gestionan rollo_fotos"
  ON public.rollo_fotos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_rollo_fotos ON public.rollo_fotos;
CREATE TRIGGER set_empresa_rollo_fotos BEFORE INSERT ON public.rollo_fotos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
