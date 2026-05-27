-- ============================================================
-- Migración 039 — Refactor post-feedback ingeniera textil
--
-- Cinco cambios en una sola migración, autorizados explícitamente
-- por el cliente. Los datos previos son de prueba: el bloque
-- arranca con TRUNCATE CASCADE para reset limpio.
--
-- 1) Rename `rollos.ratio_rendimiento` → `rollos.rinde`. El sector
--    textil llama "rinde" a la relación metros/kilos.
--
-- 2) Rename estado de pedidos `confirmada_venta` → `confirmada_egreso`.
--    Separa "rollo listo para irse" de "rollo ya egresó".
--
-- 3) Refactor M:N artículo-color. Antes (migración 038): cada fila
--    de `articulos` era una combinación (nombre, color). Ahora:
--    `articulos` solo lleva nombre; `articulo_colores` es la pivot
--    que asocia un artículo con sus colores desarrollados;
--    `rollos.color_id` apunta al color concreto, con FK compuesta
--    contra la pivot.
--
-- 4) Workflow de solicitudes de color. Solo admin crea/edita el
--    catálogo `colores`. Operario y ventas envían `solicitudes_color`
--    pendientes que el admin aprueba o rechaza.
--
-- 5) RPC `reemplazar_rollo_en_pedido` para picking. Si el operario
--    detecta falla en un rollo asignado, lo cambia por otro de igual
--    (articulo_id, color_id), guardando categoría + descripción.
--    Marca el rollo viejo como segunda calidad.
--
-- Idempotente.
-- ============================================================


-- ── 0. Reset autorizado de datos ────────────────────────────
-- El usuario validó que los datos son de prueba y pueden borrarse.

TRUNCATE
  public.rollo_fotos,
  public.movimientos,
  public.pedido_rollos,
  public.muestras,
  public.pedidos,
  public.pedidos_pendientes,
  public.ingresos,
  public.rollos,
  public.articulos,
  public.colores
RESTART IDENTITY CASCADE;


-- ── 1. Rename ratio_rendimiento → rinde ─────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'rollos'
       AND column_name = 'ratio_rendimiento'
  ) THEN
    ALTER TABLE public.rollos RENAME COLUMN ratio_rendimiento TO rinde;
  END IF;
END $$;


-- ── 2. Rename estado confirmada_venta → confirmada_egreso ───

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check CHECK (
    estado IN (
      'pendiente',
      'en_preparacion',
      'lista',
      'confirmada_egreso',
      'entregada',
      'cancelada'
    )
  );

-- Renombrar columnas de auditoría que llevaban "venta" en el nombre
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos'
       AND column_name = 'confirmada_venta_at'
  ) THEN
    ALTER TABLE public.pedidos
      RENAME COLUMN confirmada_venta_at TO confirmada_egreso_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos'
       AND column_name = 'confirmada_venta_por'
  ) THEN
    ALTER TABLE public.pedidos
      RENAME COLUMN confirmada_venta_por TO confirmada_egreso_por;
  END IF;
END $$;

-- Limpiar RPC vieja (con el nombre de "venta")
DROP FUNCTION IF EXISTS public.confirmar_venta_pedido(UUID);

-- Nueva RPC confirmar_egreso_pedido
CREATE OR REPLACE FUNCTION public.confirmar_egreso_pedido(
  p_pedido_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_empresa_id  UUID;
  v_estado      TEXT;
  v_pedido_emp  UUID;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden confirmar egresos.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado <> 'lista' THEN
    RAISE EXCEPTION
      'Solo se puede confirmar el egreso de un pedido en estado lista (estado actual: %).',
      v_estado;
  END IF;

  UPDATE pedidos
     SET estado = 'confirmada_egreso',
         confirmada_egreso_at = NOW(),
         confirmada_egreso_por = auth.uid()
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_egreso_pedido(UUID) TO authenticated;

-- Actualizar entregar_pedido para esperar el nuevo estado
CREATE OR REPLACE FUNCTION public.entregar_pedido(
  p_pedido_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_empresa_id  UUID;
  v_estado      TEXT;
  v_pedido_emp  UUID;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede marcar pedidos como entregados.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado <> 'confirmada_egreso' THEN
    RAISE EXCEPTION
      'Solo se puede entregar un pedido con egreso ya confirmado (estado actual: %). Ventas debe confirmar primero.',
      v_estado;
  END IF;

  UPDATE rollos
     SET estado = 'entregado'
   WHERE id IN (
     SELECT rollo_id FROM pedido_rollos WHERE pedido_id = p_pedido_id
   );

  UPDATE pedidos SET estado = 'entregada' WHERE id = p_pedido_id;
END;
$$;

-- Actualizar cancelar_pedido para aceptar el nuevo nombre del estado
CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_empresa_id  UUID;
  v_estado      TEXT;
  v_pedido_emp  UUID;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden cancelar pedidos.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado NOT IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_egreso') THEN
    RAISE EXCEPTION
      'No se puede cancelar un pedido en estado %.',
      v_estado;
  END IF;

  UPDATE rollos
     SET estado = 'en_stock'
   WHERE id IN (
     SELECT rollo_id FROM pedido_rollos WHERE pedido_id = p_pedido_id
   );

  UPDATE pedidos SET estado = 'cancelada' WHERE id = p_pedido_id;
END;
$$;


-- ── 3. Refactor M:N artículo-color ──────────────────────────

-- 3.a) Desactivar trigger y función que sincronizaba rollos.color
--      desde articulos.color (ya no aplica con M:N).

DROP TRIGGER IF EXISTS sync_rollo_color ON public.rollos;
DROP FUNCTION IF EXISTS public.sync_rollo_color_from_articulo();

-- 3.b) articulos pierde la columna color y la unicidad combinada;
--      pasa a ser único por nombre.

ALTER TABLE public.articulos
  DROP CONSTRAINT IF EXISTS articulos_empresa_nombre_color_key;

ALTER TABLE public.articulos
  DROP COLUMN IF EXISTS color;

ALTER TABLE public.articulos
  DROP CONSTRAINT IF EXISTS articulos_empresa_nombre_key;

ALTER TABLE public.articulos
  ADD CONSTRAINT articulos_empresa_nombre_key
  UNIQUE (empresa_id, nombre);

-- 3.c) Pivot articulo_colores: qué colores se desarrollan en cada
--      artículo. Sirve para filtrar colores disponibles al ingresar
--      rollos y para enforce-by-design la consistencia rollo↔artículo.

CREATE TABLE IF NOT EXISTS public.articulo_colores (
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  articulo_id UUID NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
  color_id    UUID NOT NULL REFERENCES colores(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (articulo_id, color_id)
);

CREATE INDEX IF NOT EXISTS articulo_colores_color_idx
  ON public.articulo_colores (color_id);
CREATE INDEX IF NOT EXISTS articulo_colores_empresa_idx
  ON public.articulo_colores (empresa_id);

ALTER TABLE public.articulo_colores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen articulo_colores de su empresa"
  ON public.articulo_colores;
CREATE POLICY "Autenticados leen articulo_colores de su empresa"
  ON public.articulo_colores FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Operario y admin gestionan articulo_colores"
  ON public.articulo_colores;
CREATE POLICY "Operario y admin gestionan articulo_colores"
  ON public.articulo_colores FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_articulo_colores ON public.articulo_colores;
CREATE TRIGGER set_empresa_articulo_colores BEFORE INSERT ON public.articulo_colores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- 3.d) rollos: dropear `color` (texto legacy) y agregar `color_id`
--      con FK compuesta a articulo_colores. NULL inicialmente y
--      después NOT NULL (por si la tabla traía rollos legacy; tras
--      el TRUNCATE no hay ninguno, así que es seguro).

ALTER TABLE public.rollos
  DROP COLUMN IF EXISTS color;

ALTER TABLE public.rollos
  ADD COLUMN IF NOT EXISTS color_id UUID;

-- Tras el TRUNCATE arriba, color_id está vacío en todas las filas.
-- Ahora lo hacemos NOT NULL.
ALTER TABLE public.rollos
  ALTER COLUMN color_id SET NOT NULL;

ALTER TABLE public.rollos
  DROP CONSTRAINT IF EXISTS rollos_articulo_color_fk;
ALTER TABLE public.rollos
  ADD CONSTRAINT rollos_articulo_color_fk
  FOREIGN KEY (articulo_id, color_id)
  REFERENCES public.articulo_colores (articulo_id, color_id);

-- articulo_id pasa a NOT NULL: sin artículo no se puede saber qué
-- combinación (articulo, color) corresponde, y la FK compuesta lo
-- exige igualmente.
ALTER TABLE public.rollos
  ALTER COLUMN articulo_id SET NOT NULL;


-- ── 4. Workflow de solicitudes de color ─────────────────────

CREATE TABLE IF NOT EXISTS public.solicitudes_color (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id),
  nombre_solicitado TEXT NOT NULL,
  motivo            TEXT,
  solicitado_por    UUID NOT NULL REFERENCES auth.users(id),
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  color_id          UUID REFERENCES colores(id),
  motivo_rechazo    TEXT,
  resuelta_por      UUID REFERENCES auth.users(id),
  resuelta_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solicitudes_color_empresa_estado_idx
  ON public.solicitudes_color (empresa_id, estado, created_at DESC);

ALTER TABLE public.solicitudes_color ENABLE ROW LEVEL SECURITY;

-- Cualquiera de la empresa puede ver las solicitudes (para ver el
-- estado de la propia y para que admin las gestione).
DROP POLICY IF EXISTS "Autenticados leen solicitudes_color de su empresa"
  ON public.solicitudes_color;
CREATE POLICY "Autenticados leen solicitudes_color de su empresa"
  ON public.solicitudes_color FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

-- Cualquier autenticado puede INSERT una solicitud para su empresa.
-- El campo `solicitado_por` debe coincidir con auth.uid() (CHECK).
DROP POLICY IF EXISTS "Autenticados crean solicitudes_color"
  ON public.solicitudes_color;
CREATE POLICY "Autenticados crean solicitudes_color"
  ON public.solicitudes_color FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND solicitado_por = auth.uid()
    AND estado = 'pendiente'
  );

-- Solo admin actualiza solicitudes (aprueba/rechaza). Las RPCs
-- de abajo bypasean RLS con SECURITY DEFINER, pero dejamos esta
-- policy por consistencia.
DROP POLICY IF EXISTS "Admin gestiona solicitudes_color"
  ON public.solicitudes_color;
CREATE POLICY "Admin gestiona solicitudes_color"
  ON public.solicitudes_color FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP TRIGGER IF EXISTS set_empresa_solicitudes_color ON public.solicitudes_color;
CREATE TRIGGER set_empresa_solicitudes_color BEFORE INSERT ON public.solicitudes_color
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- RPC: aprobar solicitud → crea el color en el catálogo y enlaza.

CREATE OR REPLACE FUNCTION public.aprobar_solicitud_color(
  p_solicitud_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_empresa_id  UUID;
  v_sol_empresa UUID;
  v_estado      TEXT;
  v_nombre      TEXT;
  v_color_id    UUID;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede aprobar solicitudes de color.';
  END IF;

  SELECT empresa_id, estado, nombre_solicitado
    INTO v_sol_empresa, v_estado, v_nombre
    FROM solicitudes_color
   WHERE id = p_solicitud_id
   FOR UPDATE;

  IF NOT FOUND OR v_sol_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Solicitud no encontrada.';
  END IF;
  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta (estado: %).', v_estado;
  END IF;

  -- Normalizar a Title Case (consistente con la migración 028).
  v_nombre := INITCAP(LOWER(TRIM(v_nombre)));

  -- Crear color (dedupe por (empresa_id, nombre)).
  INSERT INTO colores (empresa_id, nombre)
  VALUES (v_empresa_id, v_nombre)
  ON CONFLICT (empresa_id, nombre) DO UPDATE
    SET nombre = EXCLUDED.nombre  -- noop para que RETURNING funcione
  RETURNING id INTO v_color_id;

  UPDATE solicitudes_color
     SET estado = 'aprobada',
         color_id = v_color_id,
         resuelta_por = auth.uid(),
         resuelta_at = NOW()
   WHERE id = p_solicitud_id;

  RETURN v_color_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_color(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rechazar_solicitud_color(
  p_solicitud_id UUID,
  p_motivo       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_empresa_id  UUID;
  v_sol_empresa UUID;
  v_estado      TEXT;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede rechazar solicitudes de color.';
  END IF;

  SELECT empresa_id, estado
    INTO v_sol_empresa, v_estado
    FROM solicitudes_color
   WHERE id = p_solicitud_id
   FOR UPDATE;

  IF NOT FOUND OR v_sol_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Solicitud no encontrada.';
  END IF;
  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta (estado: %).', v_estado;
  END IF;

  UPDATE solicitudes_color
     SET estado = 'rechazada',
         motivo_rechazo = NULLIF(TRIM(p_motivo), ''),
         resuelta_por = auth.uid(),
         resuelta_at = NOW()
   WHERE id = p_solicitud_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_color(UUID, TEXT) TO authenticated;


-- ── 5. RPC reemplazar_rollo_en_pedido ───────────────────────
-- El operario detecta una falla en el rollo asignado y lo cambia
-- por otro de iguales características. Pide motivo categoría +
-- texto opcional. Marca el rollo viejo como 'segunda' y registra
-- la sustitución en `movimientos` con accion='reemplazar_rollo'.

CREATE OR REPLACE FUNCTION public.reemplazar_rollo_en_pedido(
  p_pedido_id        UUID,
  p_rollo_viejo_id   UUID,
  p_rollo_nuevo_id   UUID,
  p_motivo_categoria TEXT,
  p_motivo_texto     TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_empresa_id    UUID;
  v_pedido_estado TEXT;
  v_pedido_emp    UUID;
  v_pr_id_viejo   UUID;
  v_pickeado_at   TIMESTAMPTZ;
  v_articulo_v    UUID;
  v_color_v       UUID;
  v_articulo_n    UUID;
  v_color_n       UUID;
  v_estado_nuevo  TEXT;
  v_pendientes    INTEGER;
  v_total         INTEGER;
BEGIN
  IF p_motivo_categoria IS NULL THEN
    RAISE EXCEPTION 'Falta el motivo del reemplazo.';
  END IF;
  IF p_motivo_categoria NOT IN (
    'mancha', 'agujero', 'color_disparejo',
    'tono_diferente', 'rotura_tejido', 'otro'
  ) THEN
    RAISE EXCEPTION 'Motivo inválido: %.', p_motivo_categoria;
  END IF;
  IF p_rollo_viejo_id = p_rollo_nuevo_id THEN
    RAISE EXCEPTION 'El rollo de reemplazo debe ser distinto al original.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo operario o admin pueden reemplazar rollos en picking.';
  END IF;

  -- Lockear pedido + validar estado
  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion') THEN
    RAISE EXCEPTION 'Este pedido ya no admite cambios de rollos (estado: %).', v_pedido_estado;
  END IF;

  -- El rollo viejo debe pertenecer al pedido y no estar pickeado todavía.
  SELECT id, pickeado_at INTO v_pr_id_viejo, v_pickeado_at
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id
     AND rollo_id  = p_rollo_viejo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El rollo a reemplazar no está asignado a este pedido.';
  END IF;
  IF v_pickeado_at IS NOT NULL THEN
    RAISE EXCEPTION 'El rollo ya fue pickeado; no se puede reemplazar.';
  END IF;

  -- Verificar combinación articulo/color del rollo viejo y del nuevo.
  SELECT articulo_id, color_id INTO v_articulo_v, v_color_v
    FROM rollos WHERE id = p_rollo_viejo_id;
  SELECT articulo_id, color_id, estado INTO v_articulo_n, v_color_n, v_estado_nuevo
    FROM rollos WHERE id = p_rollo_nuevo_id FOR UPDATE;

  IF v_articulo_v IS NULL OR v_articulo_n IS NULL THEN
    RAISE EXCEPTION 'Rollo no encontrado.';
  END IF;
  IF v_articulo_v <> v_articulo_n OR v_color_v <> v_color_n THEN
    RAISE EXCEPTION 'El rollo de reemplazo debe tener el mismo artículo y color.';
  END IF;
  IF v_estado_nuevo NOT IN ('pendiente', 'en_stock') THEN
    RAISE EXCEPTION 'El rollo de reemplazo no está disponible (estado: %).', v_estado_nuevo;
  END IF;
  IF EXISTS (SELECT 1 FROM pedido_rollos WHERE rollo_id = p_rollo_nuevo_id) THEN
    RAISE EXCEPTION 'El rollo de reemplazo ya está asignado a otro pedido.';
  END IF;

  -- Reapuntar la asignación. UNIQUE(rollo_id) en pedido_rollos exige
  -- borrar la fila vieja antes de insertar la nueva.
  DELETE FROM pedido_rollos WHERE id = v_pr_id_viejo;
  INSERT INTO pedido_rollos (empresa_id, pedido_id, rollo_id)
  VALUES (v_empresa_id, p_pedido_id, p_rollo_nuevo_id);

  -- Marcar el rollo viejo como segunda con la falla detectada.
  UPDATE rollos
     SET estado = 'segunda',
         falla_categoria = p_motivo_categoria,
         falla_descripcion = NULLIF(TRIM(p_motivo_texto), '')
   WHERE id = p_rollo_viejo_id;

  -- Auditoría explícita del reemplazo. log_movimiento es SECURITY DEFINER.
  PERFORM log_movimiento(
    v_empresa_id,
    'pedido_rollo',
    v_pr_id_viejo,
    'reemplazar_rollo',
    jsonb_build_object(
      'pedido_id',         p_pedido_id,
      'rollo_viejo_id',    p_rollo_viejo_id,
      'rollo_nuevo_id',    p_rollo_nuevo_id,
      'motivo_categoria',  p_motivo_categoria,
      'motivo_texto',      NULLIF(TRIM(p_motivo_texto), '')
    )
  );

  -- Recalcular pendientes para que la UI pueda actualizar barra de avance.
  SELECT COUNT(*) FILTER (WHERE pickeado_at IS NULL),
         COUNT(*)
    INTO v_pendientes, v_total
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id;

  RETURN json_build_object(
    'rollo_viejo_id', p_rollo_viejo_id,
    'rollo_nuevo_id', p_rollo_nuevo_id,
    'pendientes',     v_pendientes,
    'total',          v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reemplazar_rollo_en_pedido(UUID, UUID, UUID, TEXT, TEXT)
  TO authenticated;
