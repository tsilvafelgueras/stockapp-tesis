-- ============================================================
-- Migración 023 — Patrones de extracción de código de pieza
--
-- Hasta hoy, cuando un QR/código de barras escaneado traía más
-- información que solo el número de pieza (ej. OT, color, kilos),
-- el scanner caía a un fallback peligroso (primer token separado
-- por espacios) que podía levantar el dato equivocado. El cliente
-- exige certeza absoluta: nunca un código erróneo en el modal.
--
-- Esta migration crea `tintoreria_codigo_patrones`, una tabla de
-- expresiones regulares por tintorería que el scanner consulta
-- en cada lectura para extraer el número de pieza del payload.
-- Si ningún patrón matchea, el scan se rechaza (no más basura).
--
-- - tintoreria_id NULL = patrón "interno" de fábrica, aplica a
--   cualquier rollo de la empresa sin importar la tintorería.
-- - prioridad menor = se prueba primero.
-- - capture_group = qué grupo de captura del regex es el código.
--
-- Seed inicial: un patrón global por empresa para los 9 dígitos
-- consecutivos (el formato actual del nro_pieza). Patrones más
-- específicos por tintorería se cargan con INSERTs sueltos
-- cuando se conozca el formato exacto del QR.
--
-- Idempotente.
-- ============================================================


-- ── 1. Tabla tintoreria_codigo_patrones ─────────────────────

CREATE TABLE IF NOT EXISTS public.tintoreria_codigo_patrones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id),
  tintoreria_id  UUID REFERENCES tintorerias(id) ON DELETE CASCADE,
  pattern        TEXT NOT NULL,
  capture_group  INT  NOT NULL DEFAULT 1 CHECK (capture_group >= 0),
  prioridad      INT  NOT NULL DEFAULT 100,
  descripcion    TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tintoreria_codigo_patrones_lookup_idx
  ON public.tintoreria_codigo_patrones (empresa_id, tintoreria_id, activo, prioridad);

ALTER TABLE public.tintoreria_codigo_patrones ENABLE ROW LEVEL SECURITY;


-- ── 2. RLS por empresa ──────────────────────────────────────

DROP POLICY IF EXISTS "Autenticados leen patrones de su empresa"
  ON public.tintoreria_codigo_patrones;
CREATE POLICY "Autenticados leen patrones de su empresa"
  ON public.tintoreria_codigo_patrones FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Admin gestiona patrones"
  ON public.tintoreria_codigo_patrones;
CREATE POLICY "Admin gestiona patrones"
  ON public.tintoreria_codigo_patrones FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ── 3. Trigger auto-set empresa_id ──────────────────────────

DROP TRIGGER IF EXISTS set_empresa_codigo_patrones
  ON public.tintoreria_codigo_patrones;
CREATE TRIGGER set_empresa_codigo_patrones
  BEFORE INSERT ON public.tintoreria_codigo_patrones
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── 4. Seed: patrón global por empresa ──────────────────────
-- Un patrón "interno" (tintoreria_id NULL) por cada empresa que
-- extrae los primeros 9 dígitos consecutivos del payload. Cubre
-- tanto el caso "código limpio" como "código embebido en texto"
-- siempre que no haya otros números de 9 dígitos antes del
-- nro_pieza. Si aparece una tintorería con conflicto, se agrega
-- un patrón específico con prioridad menor (más alto) para esa
-- tintorería.

INSERT INTO public.tintoreria_codigo_patrones (
  empresa_id, tintoreria_id, pattern, capture_group, prioridad, descripcion
)
SELECT
  e.id,
  NULL,
  '\b(\d{9})\b',
  1,
  100,
  '9 dígitos consecutivos (formato estándar de nro_pieza)'
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1
    FROM public.tintoreria_codigo_patrones p
   WHERE p.empresa_id = e.id
     AND p.pattern = '\b(\d{9})\b'
     AND p.tintoreria_id IS NULL
);
