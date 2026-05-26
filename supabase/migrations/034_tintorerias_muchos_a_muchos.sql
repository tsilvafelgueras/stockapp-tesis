-- ============================================================
-- Migración 034 — Tintorerías muchos-a-muchos con empresas
--
-- Reformula el modelo: hoy `tintorerias.empresa_id NOT NULL` implica
-- 1:N (cada fila pertenece a UNA empresa). Si "Tintorería Galfione"
-- trabaja con 3 empresas-cliente, hoy hay 3 filas duplicadas, cada
-- una con su propio prompt y reader_type — los devs tendrían que
-- mantenerlas en sincro a mano.
--
-- Después de esta migración:
--   - `tintorerias` es un registro maestro GLOBAL (sin empresa_id).
--     Atributos intrínsecos al proveedor: nombre, extraction_prompt,
--     reader_type. Solo el superadmin las crea/edita.
--   - Nueva pivote `empresa_tintorerias(empresa_id, tintoreria_id)`
--     guarda los atributos POR RELACIÓN: contacto, email, telefono,
--     activo, fecha_baja. El admin de empresa edita esto.
--   - `tintoreria_codigo_patrones`: `empresa_id` pasa a NULLable. Un
--     patrón con `empresa_id=NULL, tintoreria_id NOT NULL` es global
--     a esa tintorería (compartido entre empresas). Sigue siendo
--     válido `empresa_id NOT NULL, tintoreria_id NULL` para los
--     "patrones internos" de empresa (cuando la empresa pega su QR).
--
-- Estrategia de migración de datos:
--   - NO unificar tintorerías por nombre (riesgo de juntar negocios
--     distintos con coincidencia de nombre). Cada fila actual queda
--     como una tintorería pura, linkeada a su empresa actual via la
--     pivote nueva.
--   - Los patrones con tintoreria_id NOT NULL pasan a globales
--     (empresa_id = NULL). Los con tintoreria_id NULL siguen siendo
--     internos a la empresa.
--
-- Idempotente.
-- ============================================================


-- ── 1. Pivote empresa_tintorerias ─────────────────────────

CREATE TABLE IF NOT EXISTS public.empresa_tintorerias (
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tintoreria_id  UUID NOT NULL REFERENCES public.tintorerias(id) ON DELETE CASCADE,
  contacto       TEXT,
  email          TEXT,
  telefono       TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_baja     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, tintoreria_id)
);

CREATE INDEX IF NOT EXISTS empresa_tintorerias_tintoreria_idx
  ON public.empresa_tintorerias (tintoreria_id);


-- ── 2. Backfill desde tintorerias ─────────────────────────
-- Una fila por (empresa_id, id) de la tintorería actual.

INSERT INTO public.empresa_tintorerias (
  empresa_id, tintoreria_id, contacto, email, telefono, activo, fecha_baja, created_at
)
SELECT
  t.empresa_id,
  t.id,
  t.contacto,
  t.email,
  t.telefono,
  t.activo,
  t.fecha_baja,
  t.created_at
FROM public.tintorerias t
WHERE t.empresa_id IS NOT NULL
ON CONFLICT (empresa_id, tintoreria_id) DO NOTHING;


-- ── 3. Dropear policies y trigger que dependen de empresa_id
-- Hay que hacerlo ANTES del DROP COLUMN para que no falle por
-- dependencia. Los nombres se acumularon en distintas migraciones
-- (algunas con tilde "tintorerías", otras sin) — los dropeamos
-- todos sin matchear nombre exacto.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tintorerias'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tintorerias', pol.policyname);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS set_empresa_tintorerias ON public.tintorerias;


-- ── 4. tintorerias: drop columnas que se mudaron a la pivote

ALTER TABLE public.tintorerias
  DROP COLUMN IF EXISTS empresa_id,
  DROP COLUMN IF EXISTS contacto,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS telefono,
  DROP COLUMN IF EXISTS activo,
  DROP COLUMN IF EXISTS fecha_baja;


-- ── 5. RLS de tintorerias (registro maestro global) ──────
-- SELECT: cualquier autenticado puede leer (necesario porque las
--   pantallas que listan tintorerías filtrarán via la pivote).
-- INSERT/UPDATE/DELETE: solo super.

CREATE POLICY "Autenticados leen tintorerias"
  ON public.tintorerias FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Super gestiona tintorerias"
  ON public.tintorerias FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ── 6. RLS de empresa_tintorerias ─────────────────────────

ALTER TABLE public.empresa_tintorerias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen sus empresa_tintorerias"
  ON public.empresa_tintorerias;
CREATE POLICY "Autenticados leen sus empresa_tintorerias"
  ON public.empresa_tintorerias FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Admin o super gestiona empresa_tintorerias"
  ON public.empresa_tintorerias;
CREATE POLICY "Admin o super gestiona empresa_tintorerias"
  ON public.empresa_tintorerias FOR ALL TO authenticated
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

DROP TRIGGER IF EXISTS set_empresa_empresa_tintorerias ON public.empresa_tintorerias;
CREATE TRIGGER set_empresa_empresa_tintorerias
  BEFORE INSERT ON public.empresa_tintorerias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── 7. tintoreria_codigo_patrones: empresa_id NULLable ────
-- Hacemos opcional empresa_id para soportar patrones globales por
-- tintorería (empresa_id NULL, tintoreria_id NOT NULL).

ALTER TABLE public.tintoreria_codigo_patrones
  ALTER COLUMN empresa_id DROP NOT NULL;

-- Constraint: prohibimos el caso (empresa_id NULL, tintoreria_id NULL)
-- — un patrón debe estar atado al menos a una de las dos dimensiones.
ALTER TABLE public.tintoreria_codigo_patrones
  DROP CONSTRAINT IF EXISTS patron_empresa_o_tintoreria;
ALTER TABLE public.tintoreria_codigo_patrones
  ADD CONSTRAINT patron_empresa_o_tintoreria
  CHECK (empresa_id IS NOT NULL OR tintoreria_id IS NOT NULL);

-- Migrar patrones existentes con tintoreria_id NOT NULL a globales
-- (perdían sentido como duplicados por empresa). Los internos
-- (tintoreria_id NULL) mantienen su empresa_id.
UPDATE public.tintoreria_codigo_patrones
   SET empresa_id = NULL
 WHERE tintoreria_id IS NOT NULL;

-- Reemplazar policies + trigger para tolerar empresa_id NULL.

DROP POLICY IF EXISTS "Autenticados leen patrones de su empresa"
  ON public.tintoreria_codigo_patrones;
CREATE POLICY "Autenticados leen patrones aplicables"
  ON public.tintoreria_codigo_patrones FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR empresa_id IS NULL                         -- globales por tintorería
    OR empresa_id = public.current_empresa_id()   -- internos a la empresa
  );

DROP POLICY IF EXISTS "Admin gestiona patrones"
  ON public.tintoreria_codigo_patrones;
CREATE POLICY "Admin gestiona patrones internos, super los globales"
  ON public.tintoreria_codigo_patrones FOR ALL TO authenticated
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

-- El trigger set_empresa_codigo_patrones hoy setea empresa_id desde
-- el JWT en cada INSERT. Eso interfiere con los patrones globales
-- (queremos empresa_id = NULL si el caller lo seteó explícito). Lo
-- recreamos para que solo aplique cuando empresa_id NO viene
-- seteado en la fila — i.e. compatibilidad con el caso "admin
-- inserta patrón interno" sin pasar empresa_id, pero permite a
-- super insertar globales seteando empresa_id = NULL explícitamente.
--
-- Estrategia: la función set_empresa_id() es genérica y siempre
-- pisa empresa_id. La reemplazamos por una variante local que
-- respete NULLs explícitos para esta tabla.

DROP TRIGGER IF EXISTS set_empresa_codigo_patrones
  ON public.tintoreria_codigo_patrones;

CREATE OR REPLACE FUNCTION public.set_empresa_id_patron()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Si la fila YA tiene un valor decidido (NULL o no), respetarlo.
  -- Solo autocompletar si el caller envió el campo sin valor (caso
  -- típico: admin inserta sin pasar empresa_id, y el trigger
  -- antiguo lo seteaba). Como no podemos distinguir "no enviado"
  -- de "enviado NULL" en SQL, usamos una heurística: si el insert
  -- vino desde un usuario super, dejar el NULL como está; si vino
  -- desde un admin sin empresa_id seteado, autocompletar.
  IF NEW.empresa_id IS NULL AND NOT public.is_super_admin() THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_empresa_codigo_patrones
  BEFORE INSERT ON public.tintoreria_codigo_patrones
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_patron();
