-- ============================================================
-- Migracion 050 - Edicion de pedidos y reemplazo en picking
--
-- - Ventas/admin pueden editar el remito externo de pedidos abiertos.
-- - Ventas/admin pueden agregar partidas/cantidades a pedidos abiertos.
-- - Deposito/admin pueden reemplazar un rollo ya pickeado antes del egreso.
-- ============================================================

CREATE OR REPLACE FUNCTION public.actualizar_pedido_remito(
  p_pedido_id uuid,
  p_numero_remito_externo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_empresa_id  uuid;
  v_estado      text;
  v_pedido_emp  uuid;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden editar el remito del pedido.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado IN ('cancelada', 'confirmada_egreso', 'entregada') THEN
    RAISE EXCEPTION 'No se puede editar el remito de un pedido en estado %.', v_estado;
  END IF;

  UPDATE pedidos
     SET numero_remito_externo = NULLIF(trim(COALESCE(p_numero_remito_externo, '')), '')
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_pedido_remito(uuid, text)
  TO authenticated;


CREATE OR REPLACE FUNCTION public.agregar_partidas_a_pedido(
  p_pedido_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      text;
  v_empresa_id       uuid;
  v_estado           text;
  v_pedido_emp       uuid;
  v_item             record;
  v_ingreso_empresa  uuid;
  v_stock_total      integer;
  v_reservado_total  integer;
  v_disponibles      integer;
  v_kilos_estimados  numeric(10, 2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tenes que seleccionar al menos una partida.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden agregar rollos al pedido.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION 'No se pueden agregar rollos a un pedido en estado %.', v_estado;
  END IF;

  FOR v_item IN
    SELECT
      (item->>'ingreso_id')::uuid AS ingreso_id,
      (item->>'articulo_id')::uuid AS articulo_id,
      (item->>'color_id')::uuid AS color_id,
      SUM((item->>'cantidad')::integer)::integer AS cantidad
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1, 2, 3
  LOOP
    IF v_item.ingreso_id IS NULL OR v_item.articulo_id IS NULL OR v_item.color_id IS NULL THEN
      RAISE EXCEPTION 'Cada item debe tener ingreso_id, articulo_id y color_id.';
    END IF;
    IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de rollos debe ser mayor a cero.';
    END IF;

    SELECT empresa_id INTO v_ingreso_empresa
      FROM ingresos
     WHERE id = v_item.ingreso_id;
    IF v_ingreso_empresa IS NULL OR v_ingreso_empresa <> v_empresa_id THEN
      RAISE EXCEPTION 'Partida no encontrada.';
    END IF;

    PERFORM 1
      FROM rollos
     WHERE empresa_id = v_empresa_id
       AND ingreso_id = v_item.ingreso_id
       AND articulo_id = v_item.articulo_id
       AND color_id = v_item.color_id
       AND estado IN ('en_stock', 'reservado')
     FOR UPDATE;

    PERFORM 1
      FROM pedido_partidas pp
      JOIN pedidos p ON p.id = pp.pedido_id
     WHERE pp.empresa_id = v_empresa_id
       AND pp.ingreso_id = v_item.ingreso_id
       AND pp.articulo_id = v_item.articulo_id
       AND pp.color_id = v_item.color_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista')
     FOR UPDATE OF pp;

    SELECT COUNT(*) INTO v_stock_total
      FROM rollos
     WHERE empresa_id = v_empresa_id
       AND ingreso_id = v_item.ingreso_id
       AND articulo_id = v_item.articulo_id
       AND color_id = v_item.color_id
       AND estado IN ('en_stock', 'reservado');

    SELECT COALESCE(SUM(pp.rollos_solicitados), 0)::integer
      INTO v_reservado_total
      FROM pedido_partidas pp
      JOIN pedidos p ON p.id = pp.pedido_id
     WHERE pp.empresa_id = v_empresa_id
       AND pp.ingreso_id = v_item.ingreso_id
       AND pp.articulo_id = v_item.articulo_id
       AND pp.color_id = v_item.color_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista');

    v_disponibles := v_stock_total - v_reservado_total;
    IF v_item.cantidad > v_disponibles THEN
      RAISE EXCEPTION
        'La partida tiene % rollos disponibles para nuevas ventas, pero pediste %.',
        GREATEST(v_disponibles, 0), v_item.cantidad;
    END IF;

    SELECT COALESCE(SUM(kilos), 0)::numeric(10, 2)
      INTO v_kilos_estimados
      FROM (
        SELECT kilos
          FROM rollos
         WHERE empresa_id = v_empresa_id
           AND ingreso_id = v_item.ingreso_id
           AND articulo_id = v_item.articulo_id
           AND color_id = v_item.color_id
           AND estado IN ('en_stock', 'reservado')
         ORDER BY created_at ASC, numero_pieza ASC
         OFFSET GREATEST(v_reservado_total, 0)
         LIMIT v_item.cantidad
      ) seleccion_estimacion;

    INSERT INTO pedido_partidas (
      pedido_id,
      ingreso_id,
      articulo_id,
      color_id,
      rollos_solicitados,
      kilos_estimados
    )
    VALUES (
      p_pedido_id,
      v_item.ingreso_id,
      v_item.articulo_id,
      v_item.color_id,
      v_item.cantidad,
      COALESCE(v_kilos_estimados, 0)
    )
    ON CONFLICT (pedido_id, ingreso_id, articulo_id, color_id)
    DO UPDATE SET
      rollos_solicitados = pedido_partidas.rollos_solicitados + EXCLUDED.rollos_solicitados,
      kilos_estimados = pedido_partidas.kilos_estimados + EXCLUDED.kilos_estimados;
  END LOOP;

  IF v_estado = 'lista' THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.agregar_partidas_a_pedido(uuid, jsonb)
  TO authenticated;


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

  SELECT articulo_id, color_id, ingreso_id, i.numero_lote
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


-- Mantener el validador DB del agente de reportes bloqueando RPC de escritura nuevas.
CREATE OR REPLACE FUNCTION public.ejecutar_sql_reportes(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_sql text;
  v_result jsonb;
  v_limit text;
BEGIN
  SELECT role INTO v_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo admins pueden ejecutar SQL de reportes.';
  END IF;

  v_sql := regexp_replace(COALESCE(p_sql, ''), '/\*.*?\*/', ' ', 'gs');
  v_sql := regexp_replace(v_sql, '--[^\r\n]*', ' ', 'g');
  v_sql := btrim(v_sql);

  IF v_sql = '' THEN
    RAISE EXCEPTION 'La consulta SQL esta vacia.';
  END IF;

  IF length(v_sql) > 6000 THEN
    RAISE EXCEPTION 'La consulta es demasiado larga.';
  END IF;

  IF position(';' IN v_sql) > 0 THEN
    RAISE EXCEPTION 'La consulta no puede incluir punto y coma.';
  END IF;

  IF v_sql !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT o WITH readonly.';
  END IF;

  IF v_sql ~* '\m(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|call|do|set|reset|execute|prepare|deallocate|lock|vacuum|analyze|listen|notify)\M' THEN
    RAISE EXCEPTION 'La consulta usa una operacion no permitida.';
  END IF;

  IF v_sql ~* '\mfor\s+(no\s+key\s+)?update\M'
     OR v_sql ~* '\mfor\s+(key\s+)?share\M'
     OR v_sql ~* '\minto\s+(temporary|temp|unlogged)?\s*[a-z_"]' THEN
    RAISE EXCEPTION 'La consulta usa locking o SELECT INTO, no permitido.';
  END IF;

  IF v_sql ~* '\m(public\.)?(crear_pedido|crear_pedido_por_partidas|agregar_partidas_a_pedido|actualizar_pedido_remito|cancelar_pedido|entregar_pedido|confirmar_egreso_pedido|pickear_rollo|reemplazar_rollo_en_pedido|reemplazar_rollo_picking|registrar_muestra|aprobar_solicitud_color|rechazar_solicitud_color|log_movimiento|pg_sleep|pg_read_file|pg_read_binary_file|nextval|setval|pg_advisory_lock|pg_advisory_xact_lock|pg_terminate_backend|lo_import|lo_export)\s*\(' THEN
    RAISE EXCEPTION 'La consulta llama una funcion no permitida.';
  END IF;

  FOR v_limit IN
    SELECT (m)[1]
      FROM regexp_matches(v_sql, '\mlimit\s+([0-9]+)\M', 'gi') AS m
  LOOP
    IF v_limit::int > 100 THEN
      RAISE EXCEPTION 'El LIMIT maximo permitido es 100.';
    END IF;
  END LOOP;

  PERFORM set_config('statement_timeout', '5000', true);

  EXECUTE
    'SELECT COALESCE(jsonb_agg(to_jsonb(q)), ''[]''::jsonb)
       FROM (SELECT * FROM (' || v_sql || ') AS inner_q LIMIT 100) AS q'
    INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
