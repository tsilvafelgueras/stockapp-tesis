-- ============================================================
-- Migracion 058 - Picking en borrador local + "Aceptar pedido"
--
-- - El operario arma el picking en un borrador local (no escribe en DB
--   hasta aceptar). Esta migracion agrega la RPC que aplica ese borrador
--   en una sola transaccion atomica, validando disponibilidad por item.
-- - Agrega un aviso liviano de multi-sesion (heartbeat) para picking.
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS picking_session_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS picking_session_at timestamptz;


CREATE OR REPLACE FUNCTION public.aplicar_picking_pedido(
  p_pedido_id uuid,
  p_items jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      text;
  v_empresa_id       uuid;
  v_pedido_estado    text;
  v_pedido_emp       uuid;
  v_item             record;
  v_numero_pieza     text;
  v_rollo_id         uuid;
  v_rollo_kilos      numeric;
  v_rollo_articulo   uuid;
  v_rollo_color      uuid;
  v_rollo_ingreso    uuid;
  v_rollo_ubicacion  text;
  v_rollo_lote       text;
  v_rollo_estado     text;
  v_otro_numero      text;
  v_partida_id       uuid;
  v_partida_ingreso  uuid;
  v_partida_lote     text;
  v_pendientes       integer;
  v_total            integer;
  v_aplicados        jsonb := '[]'::jsonb;
  v_errores          jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'El borrador de picking es invalido.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo deposito o admin pueden aceptar el picking.';
  END IF;

  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede pickear (estado: %).', v_pedido_estado;
  END IF;

  FOR v_item IN
    SELECT DISTINCT trim(item->>'numeroPieza') AS numero_pieza
      FROM jsonb_array_elements(p_items) AS item
     WHERE trim(COALESCE(item->>'numeroPieza', '')) <> ''
     ORDER BY 1
  LOOP
    v_numero_pieza := v_item.numero_pieza;

    -- ¿Ya esta asignado a otro pedido activo?
    SELECT p.numero_pedido INTO v_otro_numero
      FROM rollos r
      JOIN pedido_rollos pr ON pr.rollo_id = r.id
      JOIN pedidos p ON p.id = pr.pedido_id
     WHERE r.numero_pieza = v_numero_pieza
       AND pr.liberado_at IS NULL
       AND pr.pedido_id <> p_pedido_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista')
       AND p.empresa_id = v_empresa_id
     LIMIT 1;

    IF v_otro_numero IS NOT NULL THEN
      v_errores := v_errores || jsonb_build_object(
        'numero_pieza', v_numero_pieza,
        'error', format('Este rollo ya esta asignado al pedido %s.', v_otro_numero)
      );
      CONTINUE;
    END IF;

    -- ¿El rollo existe, es de esta empresa y esta en stock?
    SELECT r.id, r.kilos, r.articulo_id, r.color_id, r.ingreso_id,
           r.ubicacion, r.estado, i.numero_lote
      INTO v_rollo_id, v_rollo_kilos, v_rollo_articulo, v_rollo_color,
           v_rollo_ingreso, v_rollo_ubicacion, v_rollo_estado, v_rollo_lote
      FROM rollos r
      LEFT JOIN ingresos i ON i.id = r.ingreso_id
     WHERE r.empresa_id = v_empresa_id
       AND r.numero_pieza = v_numero_pieza
     LIMIT 1
     FOR UPDATE OF r;

    IF NOT FOUND THEN
      v_errores := v_errores || jsonb_build_object(
        'numero_pieza', v_numero_pieza,
        'error', 'No se encontro este rollo.'
      );
      CONTINUE;
    END IF;

    IF v_rollo_estado <> 'en_stock' THEN
      v_errores := v_errores || jsonb_build_object(
        'numero_pieza', v_numero_pieza,
        'error', format('Este rollo ya no esta disponible (estado: %s).', v_rollo_estado)
      );
      CONTINUE;
    END IF;

    -- Buscar partida que matchee (preferencia por mismo ingreso/lote)
    SELECT pp.id, pp.ingreso_id, i.numero_lote
      INTO v_partida_id, v_partida_ingreso, v_partida_lote
      FROM pedido_partidas pp
      LEFT JOIN ingresos i ON i.id = pp.ingreso_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS cantidad
          FROM pedido_rollos pr
         WHERE pr.pedido_partida_id = pp.id
           AND pr.liberado_at IS NULL
      ) asignados ON TRUE
     WHERE pp.pedido_id = p_pedido_id
       AND pp.empresa_id = v_empresa_id
       AND pp.articulo_id = v_rollo_articulo
       AND pp.color_id = v_rollo_color
       AND COALESCE(asignados.cantidad, 0) < pp.rollos_solicitados
     ORDER BY
       CASE WHEN pp.ingreso_id = v_rollo_ingreso THEN 0 ELSE 1 END,
       pp.created_at ASC
     LIMIT 1
     FOR UPDATE OF pp;

    IF NOT FOUND THEN
      v_errores := v_errores || jsonb_build_object(
        'numero_pieza', v_numero_pieza,
        'error', 'No coincide con articulo/color pendiente del pedido, o todas las lineas ya estan completas.'
      );
      CONTINUE;
    END IF;

    INSERT INTO pedido_rollos (pedido_id, pedido_partida_id, rollo_id, pickeado_at)
    VALUES (p_pedido_id, v_partida_id, v_rollo_id, now());

    UPDATE rollos SET estado = 'reservado' WHERE id = v_rollo_id;

    v_aplicados := v_aplicados || jsonb_build_object(
      'rollo_id', v_rollo_id,
      'numero_pieza', v_numero_pieza,
      'kilos', v_rollo_kilos,
      'ubicacion', v_rollo_ubicacion,
      'articulo_id', v_rollo_articulo,
      'color_id', v_rollo_color,
      'ingreso_id', v_rollo_ingreso,
      'pedido_partida_id', v_partida_id,
      'partida_real_lote', v_rollo_lote,
      'partida_solicitada_lote', v_partida_lote,
      'es_sustitucion_partida', v_rollo_ingreso IS DISTINCT FROM v_partida_ingreso
    );
  END LOOP;

  SELECT COALESCE(SUM(rollos_solicitados), 0)::integer
    INTO v_total
    FROM pedido_partidas
   WHERE pedido_id = p_pedido_id;

  SELECT v_total - COALESCE(COUNT(*), 0)::integer
    INTO v_pendientes
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id
     AND liberado_at IS NULL;

  IF v_pendientes <= 0 THEN
    UPDATE pedidos SET estado = 'lista' WHERE id = p_pedido_id;
  ELSIF v_pedido_estado = 'pendiente' AND jsonb_array_length(v_aplicados) > 0 THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;

  IF jsonb_array_length(v_aplicados) > 0 OR jsonb_array_length(v_errores) > 0 THEN
    PERFORM public.log_movimiento(
      v_empresa_id,
      'pedido',
      p_pedido_id,
      'aplicar_picking_pedido',
      jsonb_build_object(
        'aplicados', v_aplicados,
        'errores', v_errores
      )
    );
  END IF;

  RETURN json_build_object(
    'aplicados', v_aplicados,
    'errores', v_errores,
    'pendientes', GREATEST(v_pendientes, 0),
    'total', v_total,
    'pedido_completo', v_pendientes <= 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_picking_pedido(uuid, jsonb)
  TO authenticated;


CREATE OR REPLACE FUNCTION public.marcar_sesion_picking(
  p_pedido_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role     text;
  v_empresa_id      uuid;
  v_pedido_emp      uuid;
  v_prev_por        uuid;
  v_prev_at         timestamptz;
  v_prev_nombre     text;
  v_segundos        integer;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo deposito o admin pueden pickear pedidos.';
  END IF;

  SELECT empresa_id, picking_session_por, picking_session_at
    INTO v_pedido_emp, v_prev_por, v_prev_at
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;

  UPDATE pedidos
     SET picking_session_por = auth.uid(),
         picking_session_at = now()
   WHERE id = p_pedido_id;

  IF v_prev_por IS NOT NULL
     AND v_prev_por <> auth.uid()
     AND v_prev_at IS NOT NULL
     AND v_prev_at > now() - interval '3 minutes'
  THEN
    SELECT nombre INTO v_prev_nombre FROM profiles WHERE id = v_prev_por;
    v_segundos := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_prev_at))::integer);
    RETURN json_build_object(
      'otro_usuario_nombre', COALESCE(v_prev_nombre, 'Otro usuario'),
      'hace_segundos', v_segundos
    );
  END IF;

  RETURN json_build_object(
    'otro_usuario_nombre', null,
    'hace_segundos', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_sesion_picking(uuid)
  TO authenticated;
