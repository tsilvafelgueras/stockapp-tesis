-- ============================================================
-- Migración 005 — Multi-tenant
--
-- Convierte la app a multi-tenant: cada cliente (empresa)
-- tiene sus datos completamente aislados. Esta migración:
--
-- 1. Crea la tabla `empresas` con una empresa default
--    "Muter Textil".
-- 2. Agrega `empresa_id` a profiles, articulos, tintorerias,
--    despachos, rollos, pedidos, pedido_rollos.
-- 3. Backfillea todos los datos existentes a Muter Textil.
-- 4. Hace `empresa_id` NOT NULL.
-- 5. Agrega `profiles.is_super_admin` para tu cuenta de
--    super-admin (la setean manualmente, abajo del archivo).
-- 6. Funciones helper `current_empresa_id()` y `is_super_admin()`.
-- 7. Trigger que auto-rellena `empresa_id` en cada insert
--    desde el perfil del usuario actual (el código de la app
--    no necesita seteo manual).
-- 8. Trigger `handle_new_user` actualizado para leer
--    `empresa_id` de la metadata cuando se invita un usuario.
-- 9. RLS policies reescritas para filtrar por `empresa_id`
--    en todas las tablas. Super-admin ve todas las empresas.
--
-- Idempotente.
-- ============================================================


-- ── 1. Tabla empresas ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS empresas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

INSERT INTO empresas (nombre)
SELECT 'Muter Textil'
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE nombre = 'Muter Textil');


-- ── 2. Agregar empresa_id (nullable de entrada para backfillear) ─

ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE articulos     ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE tintorerias   ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE despachos     ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE rollos        ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE pedido_rollos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);


-- ── 3. Backfill: todos los datos existentes → Muter Textil ──

DO $$
DECLARE
  default_empresa UUID;
BEGIN
  SELECT id INTO default_empresa FROM empresas WHERE nombre = 'Muter Textil' LIMIT 1;

  UPDATE profiles      SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE articulos     SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE tintorerias   SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE despachos     SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE rollos        SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE pedidos       SET empresa_id = default_empresa WHERE empresa_id IS NULL;
  UPDATE pedido_rollos SET empresa_id = default_empresa WHERE empresa_id IS NULL;
END $$;


-- ── 4. NOT NULL después del backfill ────────────────────────

ALTER TABLE profiles      ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE articulos     ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE tintorerias   ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE despachos     ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE rollos        ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE pedidos       ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE pedido_rollos ALTER COLUMN empresa_id SET NOT NULL;


-- ── 5. Super admin flag ─────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 6. Helper functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_super_admin FROM profiles WHERE id = auth.uid()), FALSE)
$$;


-- ── 7. Trigger: auto-set empresa_id on insert ───────────────

CREATE OR REPLACE FUNCTION public.set_empresa_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_empresa_articulos      ON articulos;
DROP TRIGGER IF EXISTS set_empresa_tintorerias    ON tintorerias;
DROP TRIGGER IF EXISTS set_empresa_despachos      ON despachos;
DROP TRIGGER IF EXISTS set_empresa_rollos         ON rollos;
DROP TRIGGER IF EXISTS set_empresa_pedidos        ON pedidos;
DROP TRIGGER IF EXISTS set_empresa_pedido_rollos  ON pedido_rollos;

CREATE TRIGGER set_empresa_articulos      BEFORE INSERT ON articulos      FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_tintorerias    BEFORE INSERT ON tintorerias    FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_despachos      BEFORE INSERT ON despachos      FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_rollos         BEFORE INSERT ON rollos         FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_pedidos        BEFORE INSERT ON pedidos        FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_pedido_rollos  BEFORE INSERT ON pedido_rollos  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── 8. handle_new_user actualizado ──────────────────────────
-- Lee empresa_id, role y nombre de la metadata del usuario
-- (que la setea Supabase Auth cuando se invita por email).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  empresa_uuid UUID;
BEGIN
  empresa_uuid := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'empresa_id', '')::UUID,
    (SELECT id FROM public.empresas WHERE nombre = 'Muter Textil' LIMIT 1)
  );

  INSERT INTO public.profiles (id, nombre, role, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    empresa_uuid
  );
  RETURN NEW;
END;
$$;


-- ── 9. RLS policies reescritas ──────────────────────────────

-- Empresas
DROP POLICY IF EXISTS "Super admin gestiona empresas" ON empresas;
DROP POLICY IF EXISTS "Usuarios leen su empresa"      ON empresas;

CREATE POLICY "Super admin gestiona empresas"
  ON empresas FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "Usuarios leen su empresa"
  ON empresas FOR SELECT TO authenticated
  USING (id = public.current_empresa_id());

-- Profiles
DROP POLICY IF EXISTS "Autenticados pueden leer perfiles"           ON profiles;
DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil"        ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuarios leen perfiles de su empresa"        ON profiles;
DROP POLICY IF EXISTS "Admin gestiona perfiles de su empresa"       ON profiles;

CREATE POLICY "Usuarios leen perfiles de su empresa"
  ON profiles FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Usuarios actualizan su propio perfil"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Articulos
DROP POLICY IF EXISTS "Autenticados leen artículos"                       ON articulos;
DROP POLICY IF EXISTS "Admin y operario gestionan artículos"              ON articulos;
DROP POLICY IF EXISTS "Autenticados leen artículos de su empresa"         ON articulos;
DROP POLICY IF EXISTS "Admin y operario gestionan artículos de su empresa" ON articulos;

CREATE POLICY "Autenticados leen artículos de su empresa"
  ON articulos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Admin y operario gestionan artículos de su empresa"
  ON articulos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario')
  );

-- Tintorerias
DROP POLICY IF EXISTS "Autenticados leen tintorerías"                       ON tintorerias;
DROP POLICY IF EXISTS "Admin y operario gestionan tintorerías"              ON tintorerias;
DROP POLICY IF EXISTS "Autenticados leen tintorerías de su empresa"         ON tintorerias;
DROP POLICY IF EXISTS "Admin y operario gestionan tintorerías de su empresa" ON tintorerias;

CREATE POLICY "Autenticados leen tintorerías de su empresa"
  ON tintorerias FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Admin y operario gestionan tintorerías de su empresa"
  ON tintorerias FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario')
  );

-- Despachos
DROP POLICY IF EXISTS "Autenticados leen despachos"                       ON despachos;
DROP POLICY IF EXISTS "Admin y operario gestionan despachos"              ON despachos;
DROP POLICY IF EXISTS "Autenticados leen despachos de su empresa"         ON despachos;
DROP POLICY IF EXISTS "Admin y operario gestionan despachos de su empresa" ON despachos;

CREATE POLICY "Autenticados leen despachos de su empresa"
  ON despachos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Admin y operario gestionan despachos de su empresa"
  ON despachos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario')
  );

-- Rollos
DROP POLICY IF EXISTS "Autenticados leen rollos"                       ON rollos;
DROP POLICY IF EXISTS "Admin y operario gestionan rollos"              ON rollos;
DROP POLICY IF EXISTS "Autenticados leen rollos de su empresa"         ON rollos;
DROP POLICY IF EXISTS "Admin y operario gestionan rollos de su empresa" ON rollos;

CREATE POLICY "Autenticados leen rollos de su empresa"
  ON rollos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Admin y operario gestionan rollos de su empresa"
  ON rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario')
  );

-- Pedidos
DROP POLICY IF EXISTS "Autenticados leen pedidos"                       ON pedidos;
DROP POLICY IF EXISTS "Ventas y admin gestionan pedidos"                ON pedidos;
DROP POLICY IF EXISTS "Operario actualiza estado de pedidos"            ON pedidos;
DROP POLICY IF EXISTS "Autenticados leen pedidos de su empresa"         ON pedidos;
DROP POLICY IF EXISTS "Ventas y admin gestionan pedidos de su empresa"  ON pedidos;
DROP POLICY IF EXISTS "Operario actualiza pedidos de su empresa"        ON pedidos;

CREATE POLICY "Autenticados leen pedidos de su empresa"
  ON pedidos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Ventas y admin gestionan pedidos de su empresa"
  ON pedidos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

CREATE POLICY "Operario actualiza pedidos de su empresa"
  ON pedidos FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'operario'
  );

-- Pedido_rollos
DROP POLICY IF EXISTS "Autenticados leen pedido_rollos"                       ON pedido_rollos;
DROP POLICY IF EXISTS "Ventas y admin gestionan pedido_rollos"                ON pedido_rollos;
DROP POLICY IF EXISTS "Autenticados leen pedido_rollos de su empresa"         ON pedido_rollos;
DROP POLICY IF EXISTS "Ventas y admin gestionan pedido_rollos de su empresa"  ON pedido_rollos;

CREATE POLICY "Autenticados leen pedido_rollos de su empresa"
  ON pedido_rollos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

CREATE POLICY "Ventas y admin gestionan pedido_rollos de su empresa"
  ON pedido_rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );


-- ============================================================
-- FIN DE LA MIGRACIÓN AUTOMÁTICA
--
-- Después de correr esto, tenés que setearte como super-admin
-- a vos misma. Reemplazá el email por el de tu cuenta admin
-- y corré:
--
-- UPDATE profiles SET is_super_admin = TRUE
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'TU_EMAIL_AQUI');
--
-- ============================================================
