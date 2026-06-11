-- Fix: en reemplazar_rollo_picking, "articulo_id" (y "color_id"/"ingreso_id")
-- son ambiguos porque tanto pedido_partidas como ingresos tienen esas columnas.
-- Se recrea la funcion calificando las columnas con el alias pp.

CREATE OR REPLACE FUNCTION public.reemplazar_rollo_picking(
  p_pedido_id uuid,
  p_rollo_viejo_id uuid,
  p_numero_pieza_nuevo text,
  p_motivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role       text;
  v_empresa_id        uuid;
  v_pedido_estado     text;
  v_pedido_emp        uuid;
  v_pr_id             uuid;
  v_partida_id        uuid;
  v_old_estado        text;
  v_old_numero        text;
  v_new_id            uuid;
  v_new_numero        text;
  v_new_estado        text;
  v_new_kilos         numeric;
  v_new_ubicacion     text;
  v_new_articulo      uuid;
  v_new_color         uuid;
  v_new_ingreso       uuid;
  v_new_lote          text;
  v_pp_articulo       uuid;
  v_pp_color          uuid;
  v_pp_ingreso        uuid;
  v_pp_lote           text;
BEGIN
  IF p_numero_pieza_nuevo IS NULL OR length(trim(p_numero_pieza_nuevo)) = 0 THEN
    RAISE EXCEPTION 'Falta el numero de pieza nuevo.';
  END IF;
  IF p_rollo_viejo_id IS NULL THEN
    RAISE EXCEPTION 'Falta el rollo a reemplazar.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo deposito o admin pueden reemplazar rollos en picking.';
  END IF;

  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION 'Este pedido ya no admite reemplazos (estado: %).', v_pedido_estado;
  END IF;

  SELECT pr.id, pr.pedido_partida_id, r.estado, r.numero_pieza
    INTO v_pr_id, v_partida_id, v_old_estado, v_old_numero
    FROM pedido_rollos pr
    JOIN rollos r ON r.id = pr.rollo_id
   WHERE pr.pedido_id = p_pedido_id
     AND pr.rollo_id = p_rollo_viejo_id
     AND pr.liberado_at IS NULL
     AND r.empresa_id = v_empresa_id
   FOR UPDATE OF pr, r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El rollo a reemplazar no esta activo en este pedido.';
  END IF;

  SELECT pp.articulo_id, pp.color_id, pp.ingreso_id, i.numero_lote
    INTO v_pp_articulo, v_pp_color, v_pp_ingreso, v_pp_lote
    FROM pedido_partidas pp
    LEFT JOIN ingresos i ON i.id = pp.ingreso_id
   WHERE pp.id = v_partida_id
     AND pp.empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontro la linea del pedido para el reemplazo.';
  END IF;

  SELECT r.id, r.numero_pieza, r.estado, r.kilos, r.ubicacion,
         r.articulo_id, r.color_id, r.ingreso_id, i.numero_lote
    INTO v_new_id, v_new_numero, v_new_estado, v_new_kilos, v_new_ubicacion,
         v_new_articulo, v_new_color, v_new_ingreso, v_new_lote
    FROM rollos r
    LEFT JOIN ingresos i ON i.id = r.ingreso_id
   WHERE r.empresa_id = v_empresa_id
     AND r.numero_pieza = trim(p_numero_pieza_nuevo)
   LIMIT 1
   FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontro el rollo nuevo.';
  END IF;
  IF v_new_id = p_rollo_viejo_id THEN
    RAISE EXCEPTION 'El rollo nuevo debe ser distinto al anterior.';
  END IF;
  IF v_new_estado <> 'en_stock' THEN
    RAISE EXCEPTION 'El rollo nuevo no esta disponible (estado: %).', v_new_estado;
  END IF;
  IF v_new_articulo <> v_pp_articulo OR v_new_color <> v_pp_color THEN
    RAISE EXCEPTION 'El rollo nuevo debe coincidir con el articulo y color pendientes del pedido.';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pedido_rollos pr
      JOIN pedidos p ON p.id = pr.pedido_id
     WHERE pr.rollo_id = v_new_id
       AND pr.liberado_at IS NULL
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista')
  ) THEN
    RAISE EXCEPTION 'El rollo nuevo ya esta asignado a otro pedido.';
  END IF;

  UPDATE pedido_rollos
     SET rollo_id = v_new_id,
         pickeado_at = now()
   WHERE id = v_pr_id;

  UPDATE rollos
     SET estado = 'en_stock'
   WHERE id = p_rollo_viejo_id
     AND estado IN ('reservado', 'en_stock');

  UPDATE rollos
     SET estado = 'reservado'
   WHERE id = v_new_id;

  PERFORM public.log_movimiento(
    v_empresa_id,
    'pedido_rollo',
    v_pr_id,
    'reemplazar_rollo_picking',
    jsonb_build_object(
      'pedido_id', p_pedido_id,
      'rollo_viejo_id', p_rollo_viejo_id,
      'rollo_viejo_numero', v_old_numero,
      'rollo_viejo_estado', v_old_estado,
      'rollo_nuevo_id', v_new_id,
      'rollo_nuevo_numero', v_new_numero,
      'motivo', NULLIF(trim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN json_build_object(
    'pedido_rollo_id', v_pr_id,
    'rollo_id', v_new_id,
    'numero_pieza', v_new_numero,
    'kilos', v_new_kilos,
    'ubicacion', v_new_ubicacion,
    'articulo_id', v_new_articulo,
    'color_id', v_new_color,
    'ingreso_id', v_new_ingreso,
    'pedido_partida_id', v_partida_id,
    'partida_real_lote', v_new_lote,
    'partida_solicitada_lote', v_pp_lote,
    'es_sustitucion_partida', v_new_ingreso <> v_pp_ingreso
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reemplazar_rollo_picking(uuid, uuid, text, text)
  TO authenticated;


-- Nueva RPC: quitar (eliminar) un rollo ya pickeado de un pedido.
-- Libera el pedido_rollo (liberado_at) y vuelve el rollo a en_stock,
-- conservando su ubicacion actual. Si el pedido estaba "lista", vuelve a
-- "en_preparacion" porque deja de estar completo.

CREATE OR REPLACE FUNCTION public.quitar_rollo_picking(
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

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo deposito o admin pueden quitar rollos del picking.';
  END IF;

  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION 'Este pedido ya no admite cambios en el picking (estado: %).', v_pedido_estado;
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
         liberado_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'quitado_de_picking')
   WHERE id = p_pedido_rollo_id;

  UPDATE rollos
     SET estado = 'en_stock'
   WHERE id = v_rollo_id
     AND estado IN ('reservado', 'en_stock');

  IF v_pedido_estado = 'lista' THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;

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
    'quitar_rollo_picking',
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

GRANT EXECUTE ON FUNCTION public.quitar_rollo_picking(uuid, uuid, text)
  TO authenticated;
