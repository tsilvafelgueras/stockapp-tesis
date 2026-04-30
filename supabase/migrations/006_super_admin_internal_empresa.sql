-- ============================================================
-- Migración 006 — Super-admins no pertenecen a empresa
--
-- Los super-admins son usuarios de la plataforma StockApp,
-- no de ninguna empresa-cliente. Por lo tanto su empresa_id
-- debe ser NULL.
--
-- Este migración:
-- 1. Hace profiles.empresa_id NULLABLE.
-- 2. Setea empresa_id = NULL para los super-admins existentes.
-- 3. Agrega un CHECK constraint que enforza:
--      is_super_admin = TRUE  → empresa_id IS NULL
--      is_super_admin = FALSE → empresa_id IS NOT NULL
-- 4. Actualiza el trigger handle_new_user para que respete
--    la regla cuando se crea un nuevo usuario.
--
-- Idempotente.
-- ============================================================

-- 1. Drop la NOT NULL de profiles.empresa_id
ALTER TABLE profiles ALTER COLUMN empresa_id DROP NOT NULL;

-- 2. Limpiar empresa_id de los super-admins existentes
UPDATE profiles SET empresa_id = NULL WHERE is_super_admin = TRUE;

-- 3. CHECK constraint que enforza la regla
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_super_admin_empresa_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_super_admin_empresa_check
  CHECK (
    (is_super_admin = TRUE  AND empresa_id IS NULL)
    OR (is_super_admin = FALSE AND empresa_id IS NOT NULL)
  );

-- 4. Trigger handle_new_user actualizado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  empresa_uuid UUID;
  is_super BOOLEAN;
BEGIN
  is_super := COALESCE(
    (NEW.raw_user_meta_data->>'is_super_admin')::BOOLEAN,
    FALSE
  );

  IF is_super THEN
    empresa_uuid := NULL;
  ELSE
    empresa_uuid := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'empresa_id', '')::UUID,
      (SELECT id FROM public.empresas WHERE nombre = 'Muter Textil' LIMIT 1)
    );
  END IF;

  INSERT INTO public.profiles (id, nombre, role, empresa_id, is_super_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    empresa_uuid,
    is_super
  );
  RETURN NEW;
END;
$$;
