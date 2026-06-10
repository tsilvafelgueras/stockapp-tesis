-- ============================================================
-- StockApp — Schema canónico (post Etapa 7D, 2026-05)
--
-- Este archivo refleja el estado completo del schema después
-- de aplicar las migraciones 001..011 en orden.
--
-- Para una DB nueva, podés correr:
--   1) este archivo (schema.sql), o
--   2) las migraciones en orden numérico (001..011).
--
-- Las dos opciones dejan la DB en el mismo estado funcional.
-- Las migraciones siguen siendo la fuente histórica autoritativa
-- (cada una explica el "por qué" del cambio); este archivo es
-- el "cómo está hoy" para arrancar fresh.
--
-- Las RPCs (crear_pedido, cancelar_pedido, entregar_pedido,
-- pickear_rollo, registrar_muestra) NO están duplicadas acá:
-- aplicar las migraciones 009-011 después de este archivo.
-- ============================================================


-- ── HELPERS (orden importante: las usan triggers + RLS) ─────

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'super' FROM profiles WHERE id = auth.uid()), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;


-- ── EMPRESAS (multi-tenant root) ────────────────────────────

CREATE TABLE IF NOT EXISTS empresas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super-admin gestiona empresas" ON empresas;
CREATE POLICY "Super-admin gestiona empresas"
  ON empresas FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Autenticados leen su empresa" ON empresas;
CREATE POLICY "Autenticados leen su empresa"
  ON empresas FOR SELECT TO authenticated
  USING (id = public.current_empresa_id() OR public.is_super_admin());


-- ── PROFILES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('operario', 'ventas', 'admin', 'super')),
  empresa_id  UUID REFERENCES empresas(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_super_admin_empresa_check CHECK (
    (role = 'super' AND empresa_id IS NULL)
    OR (role IN ('admin', 'ventas', 'operario') AND empresa_id IS NOT NULL)
  )
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen perfiles de su empresa" ON profiles;
CREATE POLICY "Autenticados leen perfiles de su empresa"
  ON profiles FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin gestiona perfiles de su empresa" ON profiles;
CREATE POLICY "Admin gestiona perfiles de su empresa"
  ON profiles FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  empresa_uuid UUID;
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  IF user_role = 'super' THEN
    empresa_uuid := NULL;
  ELSE
    empresa_uuid := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'empresa_id', '')::UUID,
      (SELECT id FROM public.empresas WHERE nombre = 'Muter Textil' LIMIT 1)
    );
  END IF;
  INSERT INTO public.profiles (id, nombre, role, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    user_role,
    empresa_uuid
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── ARTICULOS ───────────────────────────────────────────────
--
-- Modelo (post migración 039): el artículo es una entidad por sí
-- mismo (ej. "Lycra ML40", "SET", "Interlock"). Los colores que se
-- desarrollan sobre ese artículo viven en la pivot `articulo_colores`
-- (M:N contra `colores`). Cada rollo apunta a un (articulo_id,
-- color_id) que debe existir en la pivot — FK compuesta.

CREATE TABLE IF NOT EXISTS articulos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  stock_minimo_kg NUMERIC(10, 2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT articulos_empresa_nombre_key
    UNIQUE (empresa_id, nombre)
);

ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen articulos de su empresa" ON articulos;
CREATE POLICY "Autenticados leen articulos de su empresa"
  ON articulos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan articulos" ON articulos;
CREATE POLICY "Operario y admin gestionan articulos"
  ON articulos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_articulos ON articulos;
CREATE TRIGGER set_empresa_articulos BEFORE INSERT ON articulos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── TINTORERIAS ─────────────────────────────────────────────
--
-- Modelo: tintorerias es un registro maestro GLOBAL (sin empresa_id).
-- Los atributos intrínsecos al proveedor (nombre, prompt, reader_type)
-- viven acá. Los atributos POR RELACIÓN con cada empresa-cliente
-- (contacto, email, telefono, activo, fecha_baja) viven en la pivote
-- empresa_tintorerias. Una tintorería puede estar asociada a muchas
-- empresas y una empresa puede tener muchas tintorerías.

CREATE TABLE IF NOT EXISTS tintorerias (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre                 TEXT NOT NULL,
  extraction_prompt      TEXT,
  reader_type            TEXT CHECK (reader_type IN ('qr', 'barcode')),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN tintorerias.extraction_prompt IS
  'Prompt custom que el superadmin pega para guiar la extracción de planillas con IA. NULL = prompt default genérico.';
COMMENT ON COLUMN tintorerias.reader_type IS
  'Tipo de lector para escanear códigos de rollos: qr (html5-qrcode), barcode (@zxing/browser). NULL = lector unificado fallback.';

ALTER TABLE tintorerias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen tintorerias de su empresa" ON tintorerias;
DROP POLICY IF EXISTS "Autenticados leen tintorerias" ON tintorerias;
CREATE POLICY "Autenticados leen tintorerias"
  ON tintorerias FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Operario y admin gestionan tintorerias" ON tintorerias;
DROP POLICY IF EXISTS "Admin gestiona tintorerias" ON tintorerias;
DROP POLICY IF EXISTS "Admin o super gestiona tintorerias" ON tintorerias;
DROP POLICY IF EXISTS "Super gestiona tintorerias" ON tintorerias;
CREATE POLICY "Super gestiona tintorerias"
  ON tintorerias FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Pivote empresa_tintorerias: atributos por relación.

CREATE TABLE IF NOT EXISTS empresa_tintorerias (
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tintoreria_id  UUID NOT NULL REFERENCES tintorerias(id) ON DELETE CASCADE,
  contacto       TEXT,
  email          TEXT,
  telefono       TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_baja     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, tintoreria_id)
);

CREATE INDEX IF NOT EXISTS empresa_tintorerias_tintoreria_idx
  ON empresa_tintorerias (tintoreria_id);

ALTER TABLE empresa_tintorerias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen sus empresa_tintorerias" ON empresa_tintorerias;
CREATE POLICY "Autenticados leen sus empresa_tintorerias"
  ON empresa_tintorerias FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Admin o super gestiona empresa_tintorerias" ON empresa_tintorerias;
CREATE POLICY "Admin o super gestiona empresa_tintorerias"
  ON empresa_tintorerias FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

DROP TRIGGER IF EXISTS set_empresa_empresa_tintorerias ON empresa_tintorerias;
CREATE TRIGGER set_empresa_empresa_tintorerias BEFORE INSERT ON empresa_tintorerias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── INGRESOS (antes "despachos") ────────────────────────────

CREATE TABLE IF NOT EXISTS ingresos (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id               UUID NOT NULL REFERENCES empresas(id),
  tintoreria_id            UUID REFERENCES tintorerias(id),
  articulo_id              UUID REFERENCES articulos(id),
  fecha_despacho           DATE,
  numero_remito            TEXT,
  total_rollos_declarado   INTEGER,
  total_kilos_declarado    NUMERIC(10, 2),
  estado                   TEXT NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'auditado', 'confirmado')),
  origen                   TEXT NOT NULL DEFAULT 'manual'
                            CHECK (origen IN ('manual', 'planilla_ia')),
  imagen_url               TEXT,
  color                    TEXT,
  ot                       TEXT,
  rem_tejeduria            TEXT,
  referencia               TEXT,
  created_by               UUID REFERENCES profiles(id),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen ingresos de su empresa" ON ingresos;
CREATE POLICY "Autenticados leen ingresos de su empresa"
  ON ingresos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan ingresos" ON ingresos;
CREATE POLICY "Operario y admin gestionan ingresos"
  ON ingresos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_ingresos ON ingresos;
CREATE TRIGGER set_empresa_ingresos BEFORE INSERT ON ingresos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── ARTICULO_COLORES (pivot M:N) ────────────────────────────
--
-- Catálogo de qué colores se desarrollan sobre cada artículo.
-- Sirve para filtrar opciones de color al ingresar rollos y
-- como referente de la FK compuesta de rollos.

CREATE TABLE IF NOT EXISTS articulo_colores (
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  articulo_id UUID NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
  color_id    UUID NOT NULL REFERENCES colores(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (articulo_id, color_id)
);

CREATE INDEX IF NOT EXISTS articulo_colores_color_idx
  ON articulo_colores (color_id);
CREATE INDEX IF NOT EXISTS articulo_colores_empresa_idx
  ON articulo_colores (empresa_id);

ALTER TABLE articulo_colores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen articulo_colores de su empresa" ON articulo_colores;
CREATE POLICY "Autenticados leen articulo_colores de su empresa"
  ON articulo_colores FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan articulo_colores" ON articulo_colores;
CREATE POLICY "Operario y admin gestionan articulo_colores"
  ON articulo_colores FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_articulo_colores ON articulo_colores;
CREATE TRIGGER set_empresa_articulo_colores BEFORE INSERT ON articulo_colores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── ROLLOS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rollos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id          UUID NOT NULL REFERENCES empresas(id),
  ingreso_id          UUID NOT NULL REFERENCES ingresos(id),
  articulo_id         UUID NOT NULL REFERENCES articulos(id),
  color_id            UUID NOT NULL REFERENCES colores(id),
  numero_pieza        TEXT NOT NULL,
  ubicacion           TEXT,
  pantone             TEXT,
  foto_url            TEXT,
  kilos               NUMERIC(10, 2),
  metros              NUMERIC(10, 2),
  rinde               NUMERIC(10, 4),
  kilos_propios       NUMERIC(10, 2),
  metros_propios      NUMERIC(10, 2),
  ancho_propio        NUMERIC(10, 2),
  gramaje_propio      NUMERIC(10, 2),
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'en_stock', 'reservado', 'entregado', 'baja', 'segunda')),
  falla_categoria     TEXT
                       CHECK (
                         falla_categoria IS NULL
                         OR falla_categoria IN (
                           'mancha', 'agujero', 'color_disparejo',
                           'tono_diferente', 'rotura_tejido', 'otro'
                         )
                       ),
  falla_descripcion   TEXT,
  confianza_ia        NUMERIC(4, 3),
  gramaje_planilla    NUMERIC(5, 2),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rollos_ingreso_id_numero_pieza_key UNIQUE (ingreso_id, numero_pieza),
  -- FK compuesta: cada rollo debe apuntar a una combinación
  -- (articulo, color) que el admin ya haya asociado en la pivot.
  CONSTRAINT rollos_articulo_color_fk
    FOREIGN KEY (articulo_id, color_id)
    REFERENCES articulo_colores (articulo_id, color_id)
);

ALTER TABLE rollos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen rollos de su empresa" ON rollos;
CREATE POLICY "Autenticados leen rollos de su empresa"
  ON rollos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Admin y operario gestionan rollos de su empresa" ON rollos;
CREATE POLICY "Admin y operario gestionan rollos de su empresa"
  ON rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_rollos ON rollos;
CREATE TRIGGER set_empresa_rollos BEFORE INSERT ON rollos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── PEDIDOS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pedidos (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id               UUID NOT NULL REFERENCES empresas(id),
  numero_pedido            TEXT,
  CONSTRAINT pedidos_empresa_numero_pedido_key UNIQUE (empresa_id, numero_pedido),
  cliente                  TEXT NOT NULL,
  numero_remito_externo    TEXT,
  estado                   TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN (
                              'pendiente', 'en_preparacion', 'lista',
                              'confirmada_egreso', 'entregada', 'cancelada'
                            )),
  confirmada_egreso_at     TIMESTAMPTZ,
  confirmada_egreso_por    UUID REFERENCES auth.users(id),
  created_by               UUID REFERENCES profiles(id),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen pedidos de su empresa" ON pedidos;
CREATE POLICY "Autenticados leen pedidos de su empresa"
  ON pedidos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Ventas y admin gestionan pedidos" ON pedidos;
CREATE POLICY "Ventas y admin gestionan pedidos"
  ON pedidos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

DROP POLICY IF EXISTS "Operario actualiza pedidos de su empresa" ON pedidos;
CREATE POLICY "Operario actualiza pedidos de su empresa"
  ON pedidos FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'operario'
  );

DROP TRIGGER IF EXISTS set_empresa_pedidos ON pedidos;
CREATE TRIGGER set_empresa_pedidos BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── PEDIDO_ROLLOS (m2m) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS pedido_rollos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id   UUID NOT NULL REFERENCES empresas(id),
  pedido_id    UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  rollo_id     UUID NOT NULL REFERENCES rollos(id),
  pickeado_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rollo_id)
);

ALTER TABLE pedido_rollos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen pedido_rollos de su empresa" ON pedido_rollos;
CREATE POLICY "Autenticados leen pedido_rollos de su empresa"
  ON pedido_rollos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Ventas y admin gestionan pedido_rollos" ON pedido_rollos;
CREATE POLICY "Ventas y admin gestionan pedido_rollos"
  ON pedido_rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_pedido_rollos ON pedido_rollos;
CREATE TRIGGER set_empresa_pedido_rollos BEFORE INSERT ON pedido_rollos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── MUESTRAS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS muestras (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id             UUID NOT NULL REFERENCES empresas(id),
  rollo_id               UUID NOT NULL REFERENCES rollos(id),
  cliente                TEXT NOT NULL,
  kilos_descontados      NUMERIC(10, 2) NOT NULL CHECK (kilos_descontados > 0),
  motivo                 TEXT,
  vinculado_a_pedido_id  UUID REFERENCES pedidos(id),
  created_by             UUID REFERENCES profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen muestras de su empresa" ON muestras;
CREATE POLICY "Autenticados leen muestras de su empresa"
  ON muestras FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan muestras" ON muestras;
CREATE POLICY "Operario y admin gestionan muestras"
  ON muestras FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_muestras ON muestras;
CREATE TRIGGER set_empresa_muestras BEFORE INSERT ON muestras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── RPCs ────────────────────────────────────────────────────
-- Para una DB nueva, después de este archivo correr en orden:
--   - supabase/migrations/009_rpc_pedidos.sql
--   - supabase/migrations/010_rpc_picking.sql
--   - supabase/migrations/011_muestras.sql
--
-- Funciones disponibles:
--   crear_pedido(cliente, remito_externo, rollo_ids[])      → UUID
--   cancelar_pedido(pedido_id)                              → VOID
--   entregar_pedido(pedido_id)                              → VOID
--   pickear_rollo(pedido_id, numero_pieza)                  → JSON
--   registrar_muestra(rollo_id, kilos, cliente, motivo, pedido_id) → UUID
