-- ============================================================
-- Migracion 048 - Pedidos por partida y picking real
--
-- Ventas solicita cantidades por partida/articulo/color.
-- Deposito asigna los rollos concretos al escanear/escribir la pieza.
--
-- Estados:
-- - pendiente: pedido creado, sin picking completo
-- - en_preparacion: deposito empezo a pickear
-- - lista: pedido listo, esperando egreso fisico
-- - confirmada_egreso: deposito confirmo que salio
-- - cancelada: pedido cancelado, rollos liberados
--
-- Se mantiene "entregada" en el CHECK por compatibilidad historica,
-- pero deja de ser un paso operativo nuevo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pedido_partidas (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id),
  pedido_id          uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  ingreso_id         uuid NOT NULL REFERENCES public.ingresos(id),
  articulo_id        uuid NOT NULL REFERENCES public.articulos(id),
  color_id           uuid NOT NULL REFERENCES public.colores(id),
  rollos_solicitados integer NOT NULL CHECK (rollos_solicitados > 0),
  kilos_estimados    numeric(10, 2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, ingreso_id, articulo_id, color_id)
);

CREATE INDEX IF NOT EXISTS pedido_partidas_pedido_idx
  ON public.pedido_partidas (pedido_id);
CREATE INDEX IF NOT EXISTS pedido_partidas_partida_idx
  ON public.pedido_partidas (empresa_id, ingreso_id, articulo_id, color_id);

ALTER TABLE public.pedido_partidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen pedido_partidas de su empresa"
  ON public.pedido_partidas;
CREATE POLICY "Autenticados leen pedido_partidas de su empresa"
  ON public.pedido_partidas FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Ventas y admin gestionan pedido_partidas"
  ON public.pedido_partidas;
CREATE POLICY "Ventas y admin gestionan pedido_partidas"
  ON public.pedido_partidas FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_pedido_partidas ON public.pedido_partidas;
CREATE TRIGGER set_empresa_pedido_partidas
  BEFORE INSERT ON public.pedido_partidas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

ALTER TABLE public.pedido_rollos
  ALTER COLUMN rollo_id DROP NOT NULL;

ALTER TABLE public.pedido_rollos
  ADD COLUMN IF NOT EXISTS pedido_partida_id uuid
    REFERENCES public.pedido_partidas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedido_rollos_partida_idx
  ON public.pedido_rollos (pedido_partida_id);


DROP FUNCTION IF EXISTS public.crear_pedido_por_partidas(uuid, text, jsonb, date);

CREATE OR REPLACE FUNCTION public.crear_pedido_por_partidas(
  p_cliente_id uuid,
  p_numero_remito_externo text,
  p_items jsonb,
  p_fecha_entrega_comprometida date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      text;
  v_empresa_id       uuid;
  v_pedido_id        uuid;
  v_numero           text;
  v_cliente_nombre   text;
  v_cliente_empresa  uuid;
  v_item             record;
  v_ingreso_empresa  uuid;
  v_stock_count      integer;
  v_pendiente_previo integer;
  v_disponibles      integer;
  v_kilos_estimados  numeric(10, 2);
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Tenes que elegir un cliente del catalogo.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tenes que seleccionar al menos una partida.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
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
       AND estado = 'en_stock'
     FOR UPDATE;

    PERFORM 1
      FROM pedido_partidas pp
      JOIN pedidos p ON p.id = pp.pedido_id
     WHERE pp.empresa_id = v_empresa_id
       AND pp.ingreso_id = v_item.ingreso_id
       AND pp.articulo_id = v_item.articulo_id
       AND pp.color_id = v_item.color_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_egreso')
     FOR UPDATE OF pp;

    SELECT COUNT(*) INTO v_stock_count
      FROM rollos
     WHERE empresa_id = v_empresa_id
       AND ingreso_id = v_item.ingreso_id
       AND articulo_id = v_item.articulo_id
       AND color_id = v_item.color_id
       AND estado = 'en_stock';

    SELECT COALESCE(
      SUM(
        GREATEST(
          pp.rollos_solicitados - COALESCE(asignados.cantidad, 0),
          0
        )
      ),
      0
    )::integer
    INTO v_pendiente_previo
      FROM pedido_partidas pp
      JOIN pedidos p ON p.id = pp.pedido_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS cantidad
          FROM pedido_rollos pr
         WHERE pr.pedido_partida_id = pp.id
           AND pr.liberado_at IS NULL
      ) asignados ON TRUE
     WHERE pp.empresa_id = v_empresa_id
       AND pp.ingreso_id = v_item.ingreso_id
       AND pp.articulo_id = v_item.articulo_id
       AND pp.color_id = v_item.color_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_egreso');

    v_disponibles := v_stock_count - v_pendiente_previo;
    IF v_item.cantidad > v_disponibles THEN
      RAISE EXCEPTION
        'La partida tiene % rollos disponibles para nuevas ventas, pero pediste %.',
        GREATEST(v_disponibles, 0), v_item.cantidad;
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtext('pedido_numero_' || v_empresa_id::text));

  SELECT lpad(
    (
      COALESCE(
        MAX(NULLIF(regexp_replace(numero_pedido, '\D', '', 'g'), '')::integer),
        0
      ) + 1
    )::text,
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

  FOR v_item IN
    SELECT
      (item->>'ingreso_id')::uuid AS ingreso_id,
      (item->>'articulo_id')::uuid AS articulo_id,
      (item->>'color_id')::uuid AS color_id,
      SUM((item->>'cantidad')::integer)::integer AS cantidad
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1, 2, 3
  LOOP
    SELECT COALESCE(
      SUM(
        GREATEST(
          pp.rollos_solicitados - COALESCE(asignados.cantidad, 0),
          0
        )
      ),
      0
    )::integer
    INTO v_pendiente_previo
      FROM pedido_partidas pp
      JOIN pedidos p ON p.id = pp.pedido_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS cantidad
          FROM pedido_rollos pr
         WHERE pr.pedido_partida_id = pp.id
           AND pr.liberado_at IS NULL
      ) asignados ON TRUE
     WHERE pp.empresa_id = v_empresa_id
       AND pp.ingreso_id = v_item.ingreso_id
       AND pp.articulo_id = v_item.articulo_id
       AND pp.color_id = v_item.color_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_egreso');

    SELECT COALESCE(SUM(kilos), 0)::numeric(10, 2)
    INTO v_kilos_estimados
      FROM (
        SELECT kilos
          FROM rollos
         WHERE empresa_id = v_empresa_id
           AND ingreso_id = v_item.ingreso_id
           AND articulo_id = v_item.articulo_id
           AND color_id = v_item.color_id
           AND estado = 'en_stock'
         ORDER BY created_at ASC, numero_pieza ASC
         OFFSET v_pendiente_previo
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
      v_pedido_id,
      v_item.ingreso_id,
      v_item.articulo_id,
      v_item.color_id,
      v_item.cantidad,
      v_kilos_estimados
    );
  END LOOP;

  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido_por_partidas(uuid, text, jsonb, date)
  TO authenticated;


CREATE OR REPLACE FUNCTION public.pickear_rollo(
  p_pedido_id uuid,
  p_numero_pieza text
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
  v_pr_id_existente  uuid;
  v_pickeado_at      timestamptz;
  v_rollo_id         uuid;
  v_rollo_kilos      numeric;
  v_rollo_articulo   uuid;
  v_rollo_color      uuid;
  v_partida_id       uuid;
  v_pendientes       integer;
  v_total            integer;
  v_otro_numero      text;
BEGIN
  IF p_numero_pieza IS NULL OR length(trim(p_numero_pieza)) = 0 THEN
    RAISE EXCEPTION 'Falta el numero de pieza.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo operario o admin pueden hacer picking.';
  END IF;

  SELECT estado, empresa_id INTO v_pedido_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_estado NOT IN ('pendiente', 'en_preparacion') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede pickear (estado: %).', v_pedido_estado;
  END IF;

  SELECT pr.id, pr.pickeado_at
    INTO v_pr_id_existente, v_pickeado_at
    FROM pedido_rollos pr
    JOIN rollos r ON r.id = pr.rollo_id
   WHERE pr.pedido_id = p_pedido_id
     AND pr.liberado_at IS NULL
     AND r.numero_pieza = trim(p_numero_pieza)
   LIMIT 1;

  IF v_pr_id_existente IS NOT NULL THEN
    IF v_pickeado_at IS NOT NULL THEN
      RAISE EXCEPTION 'Este rollo ya fue pickeado.';
    END IF;
  END IF;

  SELECT r.id, r.kilos, r.articulo_id, r.color_id, pp.id
    INTO v_rollo_id, v_rollo_kilos, v_rollo_articulo, v_rollo_color, v_partida_id
    FROM rollos r
    JOIN pedido_partidas pp
      ON pp.pedido_id = p_pedido_id
     AND pp.ingreso_id = r.ingreso_id
     AND pp.articulo_id = r.articulo_id
     AND pp.color_id = r.color_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS cantidad
        FROM pedido_rollos pr
       WHERE pr.pedido_partida_id = pp.id
         AND pr.liberado_at IS NULL
    ) asignados ON TRUE
   WHERE r.empresa_id = v_empresa_id
     AND r.numero_pieza = trim(p_numero_pieza)
     AND r.estado = 'en_stock'
     AND COALESCE(asignados.cantidad, 0) < pp.rollos_solicitados
   ORDER BY r.created_at ASC, r.numero_pieza ASC
   LIMIT 1
   FOR UPDATE OF r;

  IF NOT FOUND THEN
    SELECT p.numero_pedido INTO v_otro_numero
      FROM rollos r
      JOIN pedido_rollos pr ON pr.rollo_id = r.id
      JOIN pedidos p ON p.id = pr.pedido_id
     WHERE r.numero_pieza = trim(p_numero_pieza)
       AND pr.liberado_at IS NULL
       AND pr.pedido_id <> p_pedido_id
       AND p.estado IN ('pendiente', 'en_preparacion', 'lista')
       AND p.empresa_id = v_empresa_id
     LIMIT 1;

    IF v_otro_numero IS NOT NULL THEN
      RAISE EXCEPTION 'Este rollo ya esta asignado al pedido %.', v_otro_numero;
    END IF;

    RAISE EXCEPTION 'Este rollo no pertenece a una partida pendiente de este pedido, o la partida ya esta completa.';
  END IF;

  INSERT INTO pedido_rollos (pedido_id, pedido_partida_id, rollo_id, pickeado_at)
  VALUES (p_pedido_id, v_partida_id, v_rollo_id, now());

  UPDATE rollos
     SET estado = 'reservado'
   WHERE id = v_rollo_id;

  IF v_pedido_estado = 'pendiente' THEN
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

  IF v_pendientes = 0 THEN
    UPDATE pedidos SET estado = 'lista' WHERE id = p_pedido_id;
  END IF;

  RETURN json_build_object(
    'rollo_id', v_rollo_id,
    'numero_pieza', trim(p_numero_pieza),
    'kilos', v_rollo_kilos,
    'articulo_id', v_rollo_articulo,
    'color_id', v_rollo_color,
    'pedido_partida_id', v_partida_id,
    'pendientes', v_pendientes,
    'total', v_total,
    'pedido_completo', v_pendientes = 0
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.confirmar_egreso_pedido(
  p_pedido_id uuid,
  p_comentario text DEFAULT NULL,
  p_numero_remito_salida text DEFAULT NULL
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

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo deposito o admin pueden confirmar egresos.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado <> 'lista' THEN
    RAISE EXCEPTION
      'Solo se puede confirmar el egreso de un pedido listo (estado actual: %).',
      v_estado;
  END IF;

  UPDATE rollos
     SET estado = 'entregado'
   WHERE id IN (
     SELECT rollo_id
       FROM pedido_rollos
      WHERE pedido_id = p_pedido_id
        AND liberado_at IS NULL
        AND rollo_id IS NOT NULL
   );

  UPDATE pedidos
     SET estado = 'confirmada_egreso',
         confirmada_egreso_at = now(),
         confirmada_egreso_por = auth.uid(),
         salida_comentario = NULLIF(trim(p_comentario), ''),
         numero_remito_salida = NULLIF(trim(p_numero_remito_salida), '')
   WHERE id = p_pedido_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id uuid,
  p_motivo_caida text DEFAULT NULL,
  p_comentario text DEFAULT NULL,
  p_ubicacion_reasignacion text DEFAULT 'A ordenar'
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
  v_ubicacion   text;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden cancelar pedidos.';
  END IF;

  IF p_motivo_caida IS NOT NULL
     AND trim(p_motivo_caida) <> ''
     AND p_motivo_caida NOT IN (
       'cliente_cancelo', 'precio', 'otro_proveedor', 'sin_respuesta', 'otro'
     ) THEN
    RAISE EXCEPTION 'Motivo de caida invalido: %.', p_motivo_caida;
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

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
        AND rollo_id IS NOT NULL
   );

  UPDATE pedido_rollos
     SET liberado_at = now(),
         liberado_motivo = 'pedido_cancelado'
   WHERE pedido_id = p_pedido_id
     AND liberado_at IS NULL;

  UPDATE pedidos
     SET estado = 'cancelada',
         caida_motivo = NULLIF(trim(p_motivo_caida), ''),
         caida_comentario = NULLIF(trim(p_comentario), ''),
         caida_at = now(),
         caida_por = auth.uid()
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pickear_rollo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_egreso_pedido(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid, text, text, text) TO authenticated;


-- Mantener el validador DB del agente de reportes alineado con la nueva RPC.
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

  IF v_sql ~* '\m(public\.)?(crear_pedido|crear_pedido_por_partidas|cancelar_pedido|entregar_pedido|confirmar_egreso_pedido|pickear_rollo|registrar_muestra|aprobar_solicitud_color|rechazar_solicitud_color|reemplazar_rollo_en_pedido|log_movimiento|pg_sleep|pg_read_file|pg_read_binary_file|nextval|setval|pg_advisory_lock|pg_advisory_xact_lock|pg_terminate_backend|lo_import|lo_export)\s*\(' THEN
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
