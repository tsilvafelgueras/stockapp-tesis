-- ============================================================
-- Migración 060 — Configuración de etiquetas por empresa
--
-- Hoy las medidas de la etiqueta (ancho, alto, QR, padding) están
-- hardcodeadas en src/app/rollos-sin-etiqueta/etiqueta/page.tsx. Eso
-- no escala a otras empresas con stock de etiqueta de otra medida, ni
-- permite corregir el reescalado del driver de cada impresora (el
-- problema "veo 10×10 cm pero imprime 4×4 cm").
--
-- Esta migración crea `empresa_etiqueta_config`: una fila por empresa
-- con las medidas (en mm) y un `factor_escala` de calibración para
-- compensar cualquier impresora. Lo editan operario y admin de la
-- empresa desde /rollos-sin-etiqueta/ajustes (misma puerta de acceso
-- que el etiquetado manual).
--
-- Idempotente.
-- ============================================================

-- ── 1. Tabla (una fila por empresa) ───────────────────────

CREATE TABLE IF NOT EXISTS public.empresa_etiqueta_config (
  empresa_id    UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ancho_mm      INTEGER NOT NULL DEFAULT 100 CHECK (ancho_mm BETWEEN 10 AND 500),
  alto_mm       INTEGER NOT NULL DEFAULT 100 CHECK (alto_mm  BETWEEN 10 AND 500),
  padding_mm    INTEGER NOT NULL DEFAULT 2   CHECK (padding_mm BETWEEN 0 AND 50),
  qr_mm         INTEGER NOT NULL DEFAULT 34  CHECK (qr_mm BETWEEN 5 AND 200),
  factor_escala NUMERIC NOT NULL DEFAULT 1.0 CHECK (factor_escala BETWEEN 0.1 AND 10),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 2. RLS ─────────────────────────────────────────────────
-- SELECT: cualquier autenticado de la empresa (o super).
-- INSERT/UPDATE: miembros de la empresa con rol operario o admin
--   (más permisivo que el patrón admin-only: el etiquetado manual lo
--   usan los operarios y ellos calibran su propia impresora).

ALTER TABLE public.empresa_etiqueta_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen su config de etiqueta"
  ON public.empresa_etiqueta_config;
CREATE POLICY "Autenticados leen su config de etiqueta"
  ON public.empresa_etiqueta_config FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Operario o admin gestiona config de etiqueta"
  ON public.empresa_etiqueta_config;
CREATE POLICY "Operario o admin gestiona config de etiqueta"
  ON public.empresa_etiqueta_config FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('operario', 'admin')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('operario', 'admin')
    )
  );


-- ── 3. Trigger para autocompletar empresa_id en INSERT ─────

DROP TRIGGER IF EXISTS set_empresa_etiqueta_config
  ON public.empresa_etiqueta_config;
CREATE TRIGGER set_empresa_etiqueta_config
  BEFORE INSERT ON public.empresa_etiqueta_config
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
