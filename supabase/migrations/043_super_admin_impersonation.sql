-- ============================================================
-- Migración 043 — Super-admin operando dentro de empresas cliente
--
-- Hasta ahora el rol `super` (super-admin de Nudo Stock) podía
-- crear/pausar empresas y administrar tintorerías globales, pero
-- no podía operar dentro de las empresas cliente (ver/cargar
-- artículos, colores, ingresos, pedidos, etc.). El equipo de
-- Nudo necesita ese acceso para asistir a los clientes cargando
-- datos en su nombre.
--
-- Diseño: agregamos `profiles.empresa_id_actuando`, una columna
-- auxiliar que SOLO el super-admin puede tener seteada. Mientras
-- está seteada, el super opera sobre los datos de esa empresa
-- como si fuera un admin de ella. El campo `role` NO CAMBIA —
-- sigue siendo 'super' durante toda la sesión.
--
-- Cambios:
--   1) Columna empresa_id_actuando + constraint
--   2) current_empresa_id() ahora devuelve COALESCE(actuando, propia)
--   3) Nueva función is_super_actuando()
--   4) RLS de escritura en tablas tenant acepta is_super_actuando()
--   5) movimientos.actuando_como_super para trazar auditoría
--   6) RPCs (pedidos, picking, muestras, color) aceptan super actuando
--      y leen la empresa vía current_empresa_id()
--
-- Idempotente.
-- ============================================================


-- ── 1. Columna empresa_id_actuando ──────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_id_actuando UUID REFERENCES empresas(id);

-- Solo super-admin puede tener empresa_id_actuando seteada.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_actuando_solo_super_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_actuando_solo_super_check
  CHECK (empresa_id_actuando IS NULL OR role = 'super');

CREATE INDEX IF NOT EXISTS profiles_empresa_id_actuando_idx
  ON public.profiles (empresa_id_actuando)
  WHERE empresa_id_actuando IS NOT NULL;


-- ── 2. current_empresa_id() reescrita ───────────────────────
-- Para un usuario normal: empresa_id_actuando es NULL → retorna
-- empresa_id. Mismo comportamiento que antes.
-- Para un super impersonando: empresa_id_actuando seteado →
-- retorna esa empresa. Toda RLS y todos los triggers que usan
-- este helper se comportan como si el super fuera de esa empresa.

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(empresa_id_actuando, empresa_id)
    FROM profiles WHERE id = auth.uid()
$$;


-- ── 3. is_super_actuando() ──────────────────────────────────
-- TRUE solo cuando role='super' Y hay empresa_id_actuando seteada.
-- Las policies y RPCs lo usan para distinguir "super operando
-- dentro de una empresa" del super-admin sin contexto de empresa.

CREATE OR REPLACE FUNCTION public.is_super_actuando()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role = 'super' AND empresa_id_actuando IS NOT NULL
       FROM profiles WHERE id = auth.uid()),
    FALSE
  )
$$;


-- ── 4. RLS de escritura: aceptar super actuando ─────────────
-- Patrón: las policies FOR ALL / FOR UPDATE / FOR INSERT que
-- antes pedían "empresa_id = current_empresa_id() AND role IN
-- (...)" ahora aceptan también "is_super_actuando()". Como
-- current_empresa_id() ya devuelve la empresa actuando, la
-- condición empresa_id = current_empresa_id() se cumple igual
-- para el super impersonando — solo había que aflojar el check
-- de rol.

-- articulos
DROP POLICY IF EXISTS "Operario y admin gestionan articulos" ON public.articulos;
CREATE POLICY "Operario y admin gestionan articulos"
  ON public.articulos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- articulo_colores
DROP POLICY IF EXISTS "Operario y admin gestionan articulo_colores" ON public.articulo_colores;
CREATE POLICY "Operario y admin gestionan articulo_colores"
  ON public.articulo_colores FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- colores
DROP POLICY IF EXISTS "Operario y admin gestionan colores" ON public.colores;
CREATE POLICY "Operario y admin gestionan colores"
  ON public.colores FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- clientes
DROP POLICY IF EXISTS "Ventas y admin gestionan clientes" ON public.clientes;
CREATE POLICY "Ventas y admin gestionan clientes"
  ON public.clientes FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  );

-- ingresos
DROP POLICY IF EXISTS "Operario y admin gestionan ingresos" ON public.ingresos;
CREATE POLICY "Operario y admin gestionan ingresos"
  ON public.ingresos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- rollos
DROP POLICY IF EXISTS "Admin y operario gestionan rollos de su empresa" ON public.rollos;
CREATE POLICY "Admin y operario gestionan rollos de su empresa"
  ON public.rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- pedidos
DROP POLICY IF EXISTS "Ventas y admin gestionan pedidos" ON public.pedidos;
CREATE POLICY "Ventas y admin gestionan pedidos"
  ON public.pedidos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  );

DROP POLICY IF EXISTS "Operario actualiza pedidos de su empresa" ON public.pedidos;
CREATE POLICY "Operario actualiza pedidos de su empresa"
  ON public.pedidos FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'operario'
      OR public.is_super_actuando()
    )
  );

-- pedido_rollos
DROP POLICY IF EXISTS "Ventas y admin gestionan pedido_rollos" ON public.pedido_rollos;
CREATE POLICY "Ventas y admin gestionan pedido_rollos"
  ON public.pedido_rollos FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  );

-- muestras
DROP POLICY IF EXISTS "Operario y admin gestionan muestras" ON public.muestras;
CREATE POLICY "Operario y admin gestionan muestras"
  ON public.muestras FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
      OR public.is_super_actuando()
    )
  );

-- profiles (gestión de equipo). El admin gestiona perfiles de su
-- empresa; el super actuando también.
DROP POLICY IF EXISTS "Admin gestiona perfiles de su empresa" ON public.profiles;
CREATE POLICY "Admin gestiona perfiles de su empresa"
  ON public.profiles FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles p2 WHERE p2.id = auth.uid()) = 'admin'
      OR public.is_super_actuando()
    )
  );

-- pedidos_pendientes (demandas sin stock)
DROP POLICY IF EXISTS "Ventas y admin crean pedidos_pendientes" ON public.pedidos_pendientes;
CREATE POLICY "Ventas y admin crean pedidos_pendientes"
  ON public.pedidos_pendientes FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  );

DROP POLICY IF EXISTS "Ventas y admin actualizan pedidos_pendientes" ON public.pedidos_pendientes;
CREATE POLICY "Ventas y admin actualizan pedidos_pendientes"
  ON public.pedidos_pendientes FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
      OR public.is_super_actuando()
    )
  );

-- notificaciones (admin/ventas marcan como leídas)
DROP POLICY IF EXISTS notificaciones_select_admin_ventas ON public.notificaciones;
CREATE POLICY notificaciones_select_admin_ventas ON public.notificaciones
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
         WHERE p.id = auth.uid() AND p.role IN ('admin', 'ventas')
      )
      OR public.is_super_actuando()
    )
  );

DROP POLICY IF EXISTS notificaciones_update_admin_ventas ON public.notificaciones;
CREATE POLICY notificaciones_update_admin_ventas ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
         WHERE p.id = auth.uid() AND p.role IN ('admin', 'ventas')
      )
      OR public.is_super_actuando()
    )
  );


-- ── 5. Auditoría: actuando_como_super en movimientos ────────
-- Marca cada movimiento generado mientras el super actuaba en la
-- empresa. /admin/historial puede mostrarlo como insignia.

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS actuando_como_super BOOLEAN NOT NULL DEFAULT FALSE;

-- log_movimiento ahora setea el flag automáticamente desde
-- is_super_actuando(). No requiere cambios en los triggers por
-- entidad (todos pasan por esta función).
CREATE OR REPLACE FUNCTION public.log_movimiento(
  p_empresa_id UUID,
  p_entidad TEXT,
  p_entidad_id UUID,
  p_accion TEXT,
  p_detalle JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_empresa_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.movimientos (
    empresa_id, entidad, entidad_id, accion,
    usuario_id, detalle, actuando_como_super
  )
  VALUES (
    p_empresa_id, p_entidad, p_entidad_id, p_accion,
    auth.uid(), p_detalle, public.is_super_actuando()
  );
END;
$$;


-- ── 6. RPCs reescritas para aceptar super actuando ──────────
-- Patrón: en lugar de leer empresa_id directo de profiles, usar
-- current_empresa_id() (que ya devuelve la empresa actuando si
-- corresponde). Las validaciones de rol aceptan
-- is_super_actuando() además de los roles tenant existentes.

-- crear_pedido
DROP FUNCTION IF EXISTS public.crear_pedido(UUID, TEXT, UUID[], DATE);

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_cliente_id UUID,
  p_numero_remito_externo TEXT,
  p_rollo_ids UUID[],
  p_fecha_entrega_comprometida DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    TEXT;
  v_empresa_id     UUID;
  v_pedido_id      UUID;
  v_numero         TEXT;
  v_invalidos      INTEGER;
  v_total          INTEGER;
  v_cliente_nombre TEXT;
  v_cliente_empresa UUID;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que elegir un cliente del catálogo.';
  END IF;
  IF p_rollo_ids IS NULL OR array_length(p_rollo_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Tenés que seleccionar al menos un rollo.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('ventas', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden crear pedidos.';
  END IF;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario.';
  END IF;

  SELECT nombre, empresa_id INTO v_cliente_nombre, v_cliente_empresa
    FROM clientes WHERE id = p_cliente_id AND activo = TRUE;
  IF v_cliente_nombre IS NULL OR v_cliente_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('pedido_numero_' || v_empresa_id::TEXT)
  );

  PERFORM 1 FROM rollos WHERE id = ANY(p_rollo_ids) FOR UPDATE;

  SELECT COUNT(*) INTO v_invalidos
    FROM unnest(p_rollo_ids) AS rid
   WHERE NOT EXISTS (
     SELECT 1 FROM rollos r
      WHERE r.id = rid
        AND r.empresa_id = v_empresa_id
        AND r.estado = 'en_stock'
   );
  v_total := array_length(p_rollo_ids, 1);

  IF v_invalidos > 0 THEN
    RAISE EXCEPTION
      '% de los % rollos seleccionados ya no están disponibles. Refrescá la lista y volvé a intentar.',
      v_invalidos, v_total;
  END IF;

  SELECT lpad(
    (
      COALESCE(
        MAX(NULLIF(regexp_replace(numero_pedido, '\D', '', 'g'), '')::INTEGER),
        0
      ) + 1
    )::TEXT,
    5,
    '0'
  )
  INTO v_numero
  FROM pedidos
  WHERE empresa_id = v_empresa_id;

  INSERT INTO pedidos (
    numero_pedido,
    cliente,
    cliente_id,
    numero_remito_externo,
    fecha_entrega_comprometida,
    estado,
    created_by
  )
  VALUES (
    v_numero,
    v_cliente_nombre,
    p_cliente_id,
    NULLIF(trim(p_numero_remito_externo), ''),
    p_fecha_entrega_comprometida,
    'pendiente',
    auth.uid()
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedido_rollos (pedido_id, rollo_id)
  SELECT v_pedido_id, rid FROM unnest(p_rollo_ids) AS rid;

  UPDATE rollos
     SET estado = 'reservado'
   WHERE id = ANY(p_rollo_ids);

  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido(UUID, TEXT, UUID[], DATE)
  TO authenticated;


-- cancelar_pedido
DROP FUNCTION IF EXISTS public.cancelar_pedido(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id UUID,
  p_motivo_caida TEXT DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL,
  p_ubicacion_reasignacion TEXT DEFAULT 'A ordenar'
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
  v_ubicacion   TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('ventas', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden cancelar pedidos.';
  END IF;

  IF p_motivo_caida IS NOT NULL
     AND trim(p_motivo_caida) <> ''
     AND p_motivo_caida NOT IN (
       'cliente_cancelo',
       'precio',
       'otro_proveedor',
       'sin_respuesta',
       'otro'
     ) THEN
    RAISE EXCEPTION 'Motivo de caida invalido: %.', p_motivo_caida;
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado NOT IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_egreso') THEN
    RAISE EXCEPTION 'No se puede cancelar un pedido en estado %.', v_estado;
  END IF;

  v_ubicacion := COALESCE(NULLIF(trim(p_ubicacion_reasignacion), ''), 'A ordenar');

  UPDATE rollos
     SET estado = 'en_stock',
         ubicacion = v_ubicacion
   WHERE id IN (
     SELECT rollo_id
       FROM pedido_rollos
      WHERE pedido_id = p_pedido_id
        AND liberado_at IS NULL
   );

  UPDATE pedido_rollos
     SET liberado_at = NOW(),
         liberado_motivo = 'pedido_cancelado'
   WHERE pedido_id = p_pedido_id
     AND liberado_at IS NULL;

  UPDATE pedidos
     SET estado = 'cancelada',
         caida_motivo = NULLIF(trim(p_motivo_caida), ''),
         caida_comentario = NULLIF(trim(p_comentario), ''),
         caida_at = NOW(),
         caida_por = auth.uid()
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_pedido(UUID, TEXT, TEXT, TEXT)
  TO authenticated;


-- entregar_pedido
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
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role <> 'admin' AND NOT public.is_super_actuando() THEN
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
      'Solo se puede entregar un pedido con salida ya confirmada (estado actual: %). Ventas debe confirmar la salida primero.',
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


-- confirmar_egreso_pedido
CREATE OR REPLACE FUNCTION public.confirmar_egreso_pedido(
  p_pedido_id UUID,
  p_comentario TEXT DEFAULT NULL,
  p_numero_remito_salida TEXT DEFAULT NULL
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
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('ventas', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden confirmar salidas.';
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
      'Solo se puede confirmar la salida de un pedido en estado lista (estado actual: %).',
      v_estado;
  END IF;

  UPDATE pedidos
     SET estado = 'confirmada_egreso',
         confirmada_egreso_at = NOW(),
         confirmada_egreso_por = auth.uid(),
         salida_comentario = NULLIF(trim(p_comentario), ''),
         numero_remito_salida = NULLIF(trim(p_numero_remito_salida), '')
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_egreso_pedido(UUID, TEXT, TEXT)
  TO authenticated;


-- pickear_rollo
CREATE OR REPLACE FUNCTION public.pickear_rollo(
  p_pedido_id UUID,
  p_numero_pieza TEXT
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
  v_pr_id         UUID;
  v_rollo_id      UUID;
  v_pickeado_at   TIMESTAMPTZ;
  v_pendientes    INTEGER;
  v_total         INTEGER;
  v_otro_numero   TEXT;
BEGIN
  IF p_numero_pieza IS NULL OR length(trim(p_numero_pieza)) = 0 THEN
    RAISE EXCEPTION 'Falta el número de pieza.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('operario', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo operario o admin pueden hacer picking.';
  END IF;

  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede pickear (estado: %).', v_pedido_estado;
  END IF;

  SELECT pr.id, pr.rollo_id, pr.pickeado_at
    INTO v_pr_id, v_rollo_id, v_pickeado_at
    FROM pedido_rollos pr
    JOIN rollos r ON r.id = pr.rollo_id
   WHERE pr.pedido_id = p_pedido_id
     AND r.numero_pieza = trim(p_numero_pieza);

  IF NOT FOUND THEN
    SELECT p.numero_pedido INTO v_otro_numero
      FROM rollos r
      JOIN pedido_rollos pr ON pr.rollo_id = r.id
      JOIN pedidos p ON p.id = pr.pedido_id
     WHERE r.numero_pieza = trim(p_numero_pieza)
       AND pr.pedido_id <> p_pedido_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista')
       AND p.empresa_id = v_empresa_id
     LIMIT 1;

    IF v_otro_numero IS NOT NULL THEN
      RAISE EXCEPTION 'Este rollo ya está asignado al pedido %.', v_otro_numero;
    END IF;

    RAISE EXCEPTION 'Este rollo no pertenece a este pedido.';
  END IF;
  IF v_pickeado_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este rollo ya fue pickeado.';
  END IF;

  UPDATE pedido_rollos SET pickeado_at = NOW() WHERE id = v_pr_id;

  IF v_pedido_estado = 'pendiente' THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;

  SELECT COUNT(*) FILTER (WHERE pickeado_at IS NULL),
         COUNT(*)
    INTO v_pendientes, v_total
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id;

  IF v_pendientes = 0 THEN
    UPDATE pedidos SET estado = 'lista' WHERE id = p_pedido_id;
  END IF;

  RETURN json_build_object(
    'rollo_id', v_rollo_id,
    'numero_pieza', trim(p_numero_pieza),
    'pendientes', v_pendientes,
    'total', v_total,
    'pedido_completo', v_pendientes = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pickear_rollo(UUID, TEXT) TO authenticated;


-- registrar_muestra
CREATE OR REPLACE FUNCTION public.registrar_muestra(
  p_rollo_id UUID,
  p_kilos NUMERIC,
  p_cliente TEXT,
  p_motivo TEXT,
  p_pedido_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_empresa_id   UUID;
  v_rollo_kilos  NUMERIC;
  v_rollo_emp    UUID;
  v_rollo_estado TEXT;
  v_muestra_id   UUID;
BEGIN
  IF p_kilos IS NULL OR p_kilos <= 0 THEN
    RAISE EXCEPTION 'Los kilos descontados deben ser mayores a cero.';
  END IF;
  IF p_cliente IS NULL OR length(trim(p_cliente)) = 0 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('operario', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo operario o admin pueden registrar muestras.';
  END IF;

  SELECT kilos, empresa_id, estado
    INTO v_rollo_kilos, v_rollo_emp, v_rollo_estado
    FROM rollos
   WHERE id = p_rollo_id
   FOR UPDATE;

  IF NOT FOUND OR v_rollo_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Rollo no encontrado.';
  END IF;
  IF v_rollo_estado NOT IN ('en_stock', 'reservado') THEN
    RAISE EXCEPTION 'Solo se pueden tomar muestras de rollos en stock o reservados.';
  END IF;
  IF COALESCE(v_rollo_kilos, 0) - p_kilos < 0 THEN
    RAISE EXCEPTION 'No alcanzan los kilos del rollo (% disponibles, % pedidos).',
      v_rollo_kilos, p_kilos;
  END IF;

  IF p_pedido_id IS NOT NULL THEN
    PERFORM 1 FROM pedidos
     WHERE id = p_pedido_id AND empresa_id = v_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido vinculado no encontrado.';
    END IF;
  END IF;

  INSERT INTO muestras (
    rollo_id, cliente, kilos_descontados, motivo,
    vinculado_a_pedido_id, created_by
  )
  VALUES (
    p_rollo_id,
    trim(p_cliente),
    p_kilos,
    NULLIF(trim(p_motivo), ''),
    p_pedido_id,
    auth.uid()
  )
  RETURNING id INTO v_muestra_id;

  UPDATE rollos
     SET kilos = COALESCE(kilos, 0) - p_kilos
   WHERE id = p_rollo_id;

  RETURN v_muestra_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_muestra(UUID, NUMERIC, TEXT, TEXT, UUID)
  TO authenticated;


-- aprobar_solicitud_color
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
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role <> 'admin' AND NOT public.is_super_actuando() THEN
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

  v_nombre := INITCAP(LOWER(TRIM(v_nombre)));

  INSERT INTO colores (empresa_id, nombre)
  VALUES (v_empresa_id, v_nombre)
  ON CONFLICT (empresa_id, nombre) DO UPDATE
    SET nombre = EXCLUDED.nombre
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


-- rechazar_solicitud_color
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
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role <> 'admin' AND NOT public.is_super_actuando() THEN
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


-- reemplazar_rollo_en_pedido
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

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  v_empresa_id := public.current_empresa_id();

  IF v_caller_role NOT IN ('operario', 'admin')
     AND NOT public.is_super_actuando() THEN
    RAISE EXCEPTION 'Solo operario o admin pueden reemplazar rollos en picking.';
  END IF;

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

  DELETE FROM pedido_rollos WHERE id = v_pr_id_viejo;
  INSERT INTO pedido_rollos (empresa_id, pedido_id, rollo_id)
  VALUES (v_empresa_id, p_pedido_id, p_rollo_nuevo_id);

  UPDATE rollos
     SET estado = 'segunda',
         falla_categoria = p_motivo_categoria,
         falla_descripcion = NULLIF(TRIM(p_motivo_texto), '')
   WHERE id = p_rollo_viejo_id;

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
