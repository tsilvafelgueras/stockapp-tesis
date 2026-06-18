-- ============================================================
-- Migración 059 - Ventas quita rollos del pedido + aviso al operario
--
-- Hasta ahora solo operario/admin podían quitar rollos del picking
-- (quitar_rollo_picking, mig 056), y el rollo conservaba su ubicación.
--
-- Ventas necesita poder quitar rollos (y líneas de demanda) de un pedido.
-- Cuando lo hace:
--   - el rollo vuelve a stock (estado 'en_stock') marcado como 'Sin ubicar',
--     para que el operario lo reubique físicamente;
--   - se inserta una NOTIFICACIÓN PERSISTIDA para el operario (tipo nuevo
--     'rollo_liberado') avisando qué rollo se liberó y de qué pedido.
--
-- Quitar ≠ dar de baja: el rollo sigue en stock; solo el operario puede darlo
-- de baja del inventario.
--
-- Idempotente.
-- ============================================================

-- 1) Nuevo tipo de notificación ------------------------------------------------

ALTER TABLE public.notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('stock_minimo', 'rollo_liberado'));

-- 2) RLS: el operario puede ver/descartar SOLO las notificaciones de tipo
--    'rollo_liberado' de su empresa (las de stock_minimo siguen siendo de
--    admin/ventas). Las policies de admin/ventas de la mig 024 se mantienen.

DROP POLICY IF EXISTS notificaciones_select_operario ON public.notificaciones;
CREATE POLICY notificaciones_select_operario ON public.notificaciones
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND tipo = 'rollo_liberado'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'operario'
    )
  );

DROP POLICY IF EXISTS notificaciones_update_operario ON public.notificaciones;
CREATE POLICY notificaciones_update_operario ON public.notificaciones
  FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND tipo = 'rollo_liberado'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'operario'
    )
  );

-- 3) Helper: inserta la notificación de rollo liberado. SECURITY DEFINER para
--    poder escribir aunque el que dispara sea ventas (que no tiene INSERT en la
--    tabla). articulo_id/color_id quedan NULL a propósito: así el índice único
--    parcial (empresa, tipo, articulo_id, color_id) WHERE resuelta_at IS NULL no
--    deduplica eventos de rollos distintos (NULL es distinto de NULL en UNIQUE).

CREATE OR REPLACE FUNCTION public.notificar_rollo_liberado(
  p_empresa_id uuid,
  p_numero_pieza text,
  p_numero_pedido text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificaciones (empresa_id, tipo, titulo, mensaje)
  VALUES (
    p_empresa_id,
    'rollo_liberado',
    'Rollo liberado de pedido',
    'El rollo ' || COALESCE(p_numero_pieza, '?')
      || ' fue quitado del pedido ' || COALESCE(p_numero_pedido, '-')
      || ' y volvió a stock como "Sin ubicar". Asignale una ubicación.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_rollo_liberado(uuid, text, text)
  TO authenticated;

-- 4) RPC: quitar un rollo pickeado de un pedido (ventas/admin/operario).
--    Libera el pedido_rollo, devuelve el rollo a 'en_stock' marcado 'Sin ubicar'
--    y notifica al operario. Si el pedido estaba 'lista', vuelve a
--    'en_preparacion' porque deja de estar completo.

CREATE OR REPLACE FUNCTION public.liberar_rollo_de_pedido(
  p_pedido_id uuid,
  p_pedido_rollo_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    text;
  v_empresa_id     uuid;
  v_pedido_estado  text;
  v_pedido_emp     uuid;
  v_numero_pedido  text;
  v_rollo_id       uuid;
  v_partida_id     uuid;
  v_numero_pieza   text;
  v_total          integer;
  v_pendientes     integer;
BEGIN
  IF p_pedido_rollo_id IS NULL THEN
    RAISE EXCEPTION 'Falta el rollo a quitar.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin', 'operario') THEN
    RAISE EXCEPTION 'No tenés permiso para quitar rollos del pedido.';
  END IF;

  SELECT estado, empresa_id, numero_pedido
    INTO v_pedido_estado, v_pedido_emp, v_numero_pedido
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION 'Este pedido ya no admite cambios (estado: %).', v_pedido_estado;
  END IF;

  SELECT pr.rollo_id, pr.pedido_partida_id, r.numero_pieza
    INTO v_rollo_id, v_partida_id, v_numero_pieza
    FROM pedido_rollos pr
    JOIN rollos r ON r.id = pr.rollo_id
   WHERE pr.id = p_pedido_rollo_id
     AND pr.pedido_id = p_pedido_id
     AND pr.liberado_at IS NULL
     AND r.empresa_id = v_empresa_id
   FOR UPDATE OF pr, r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El rollo a quitar no esta activo en este pedido.';
  END IF;

  UPDATE pedido_rollos
     SET liberado_at = now(),
         liberado_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'quitado_por_ventas')
   WHERE id = p_pedido_rollo_id;

  UPDATE rollos
     SET estado = 'en_stock',
         ubicacion = 'Sin ubicar'
   WHERE id = v_rollo_id
     AND estado IN ('reservado', 'en_stock');

  IF v_pedido_estado = 'lista' THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;

  PERFORM public.notificar_rollo_liberado(v_empresa_id, v_numero_pieza, v_numero_pedido);

  SELECT COALESCE(SUM(rollos_solicitados), 0)::integer
    INTO v_total
    FROM pedido_partidas
   WHERE pedido_id = p_pedido_id;

  SELECT v_total - COALESCE(COUNT(*), 0)::integer
    INTO v_pendientes
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id
     AND liberado_at IS NULL;

  PERFORM public.log_movimiento(
    v_empresa_id,
    'pedido_rollo',
    p_pedido_rollo_id,
    'liberar_rollo_de_pedido',
    jsonb_build_object(
      'pedido_id', p_pedido_id,
      'rollo_id', v_rollo_id,
      'numero_pieza', v_numero_pieza,
      'motivo', NULLIF(trim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN json_build_object(
    'pedido_rollo_id', p_pedido_rollo_id,
    'rollo_id', v_rollo_id,
    'numero_pieza', v_numero_pieza,
    'pedido_partida_id', v_partida_id,
    'pendientes', v_pendientes,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.liberar_rollo_de_pedido(uuid, uuid, text)
  TO authenticated;

-- 5) RPC: quitar una línea de demanda entera (ventas/admin). Libera todos sus
--    rollos pickeados activos (cada uno → en_stock 'Sin ubicar' + notificación)
--    y elimina la línea de pedido_partidas.

CREATE OR REPLACE FUNCTION public.quitar_partida_de_pedido(
  p_pedido_partida_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    text;
  v_empresa_id     uuid;
  v_pedido_id      uuid;
  v_pedido_estado  text;
  v_numero_pedido  text;
  v_liberados      integer := 0;
  v_total          integer;
  v_pendientes     integer;
  r_pr             RECORD;
BEGIN
  IF p_pedido_partida_id IS NULL THEN
    RAISE EXCEPTION 'Falta la partida a quitar.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden quitar líneas del pedido.';
  END IF;

  SELECT pp.pedido_id INTO v_pedido_id
    FROM pedido_partidas pp
   WHERE pp.id = p_pedido_partida_id
     AND pp.empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de pedido no encontrada.';
  END IF;

  SELECT estado, numero_pedido INTO v_pedido_estado, v_numero_pedido
    FROM pedidos WHERE id = v_pedido_id FOR UPDATE;

  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION 'Este pedido ya no admite cambios (estado: %).', v_pedido_estado;
  END IF;

  -- Liberar cada rollo pickeado activo de la partida.
  FOR r_pr IN
    SELECT pr.id AS pr_id, pr.rollo_id, r.numero_pieza
      FROM pedido_rollos pr
      JOIN rollos r ON r.id = pr.rollo_id
     WHERE pr.pedido_partida_id = p_pedido_partida_id
       AND pr.liberado_at IS NULL
       AND r.empresa_id = v_empresa_id
     FOR UPDATE OF pr, r
  LOOP
    UPDATE pedido_rollos
       SET liberado_at = now(),
           liberado_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'partida_quitada_por_ventas')
     WHERE id = r_pr.pr_id;

    UPDATE rollos
       SET estado = 'en_stock',
           ubicacion = 'Sin ubicar'
     WHERE id = r_pr.rollo_id
       AND estado IN ('reservado', 'en_stock');

    PERFORM public.notificar_rollo_liberado(v_empresa_id, r_pr.numero_pieza, v_numero_pedido);
    v_liberados := v_liberados + 1;
  END LOOP;

  -- Eliminar la línea de demanda. (pedido_rollos.pedido_partida_id queda NULL
  -- por ON DELETE SET NULL, pero ya están liberados.)
  DELETE FROM pedido_partidas WHERE id = p_pedido_partida_id;

  SELECT COALESCE(SUM(rollos_solicitados), 0)::integer
    INTO v_total
    FROM pedido_partidas
   WHERE pedido_id = v_pedido_id;

  SELECT v_total - COALESCE(COUNT(*), 0)::integer
    INTO v_pendientes
    FROM pedido_rollos
   WHERE pedido_id = v_pedido_id
     AND liberado_at IS NULL;

  -- Si quedó incompleto y estaba 'lista', vuelve a preparación.
  IF v_pedido_estado = 'lista' AND v_pendientes > 0 THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = v_pedido_id;
  END IF;

  PERFORM public.log_movimiento(
    v_empresa_id,
    'pedido_partida',
    p_pedido_partida_id,
    'quitar_partida_de_pedido',
    jsonb_build_object(
      'pedido_id', v_pedido_id,
      'rollos_liberados', v_liberados,
      'motivo', NULLIF(trim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN json_build_object(
    'pedido_id', v_pedido_id,
    'rollos_liberados', v_liberados,
    'pendientes', v_pendientes,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quitar_partida_de_pedido(uuid, text)
  TO authenticated;
