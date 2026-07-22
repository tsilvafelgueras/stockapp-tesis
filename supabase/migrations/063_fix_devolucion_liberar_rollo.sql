-- ============================================================
-- Migración 063 - Fix: devolver rollos debe setear liberado_at
--
-- Bug: devolver_rollos_pedido y devolver_rollo_por_rollo_id
-- seteaban devuelto_at pero no liberado_at. El índice único
-- pedidos_rollos_rollo_id_activo_key filtra WHERE liberado_at IS NULL,
-- por lo que la fila devuelta seguía bloqueando el picking del mismo
-- rollo en un pedido nuevo.
--
-- Fix:
--   1) Backfill de filas ya devueltas sin liberado_at
--   2) Reescritura de ambas RPCs con liberado_at incluido
--
-- Idempotente.
-- ============================================================

-- 1) Backfill: filas devueltas que aún bloquean el índice -----

UPDATE public.pedido_rollos
   SET liberado_at     = devuelto_at,
       liberado_motivo = 'devolucion_cliente'
 WHERE devuelto_at IS NOT NULL
   AND liberado_at IS NULL;

-- 2) RPC devolver_rollos_pedido con liberado_at ---------------

CREATE OR REPLACE FUNCTION public.devolver_rollos_pedido(
  p_pedido_id        uuid,
  p_pedido_rollo_ids uuid[],
  p_motivo           text DEFAULT NULL
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
  v_devueltos      integer := 0;
  r_pr             RECORD;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin', 'operario') THEN
    RAISE EXCEPTION 'No tenés permiso para devolver rollos.';
  END IF;

  SELECT estado, empresa_id, numero_pedido
    INTO v_pedido_estado, v_pedido_emp, v_numero_pedido
    FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;

  IF v_pedido_estado <> 'confirmada_egreso' THEN
    RAISE EXCEPTION
      'Solo se pueden devolver rollos de pedidos ya entregados (estado: %).',
      v_pedido_estado;
  END IF;

  FOR r_pr IN
    SELECT pr.id AS pr_id, pr.rollo_id, r.numero_pieza
      FROM pedido_rollos pr
      JOIN rollos r ON r.id = pr.rollo_id
     WHERE pr.id = ANY(p_pedido_rollo_ids)
       AND pr.pedido_id = p_pedido_id
       AND pr.devuelto_at IS NULL
       AND pr.liberado_at IS NULL
       AND r.empresa_id = v_empresa_id
     FOR UPDATE OF pr, r
  LOOP
    UPDATE pedido_rollos
       SET devuelto_at     = now(),
           devuelto_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'devolucion_cliente'),
           liberado_at     = now(),
           liberado_motivo = 'devolucion_cliente'
     WHERE id = r_pr.pr_id;

    UPDATE rollos
       SET estado    = 'en_stock',
           ubicacion = 'Sin ubicar'
     WHERE id = r_pr.rollo_id
       AND estado = 'entregado';

    PERFORM public.notificar_rollo_devuelto(
      v_empresa_id, r_pr.numero_pieza, v_numero_pedido
    );

    PERFORM public.log_movimiento(
      v_empresa_id,
      'pedido_rollo',
      r_pr.pr_id,
      'devolver_rollo',
      jsonb_build_object(
        'pedido_id',    p_pedido_id,
        'rollo_id',     r_pr.rollo_id,
        'numero_pieza', r_pr.numero_pieza,
        'motivo',       NULLIF(trim(COALESCE(p_motivo, '')), '')
      )
    );

    v_devueltos := v_devueltos + 1;
  END LOOP;

  IF v_devueltos = 0 THEN
    RAISE EXCEPTION 'No se encontraron rollos activos para devolver.';
  END IF;

  RETURN json_build_object('devueltos', v_devueltos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.devolver_rollos_pedido(uuid, uuid[], text)
  TO authenticated;

-- 3) RPC devolver_rollo_por_rollo_id con liberado_at ----------

CREATE OR REPLACE FUNCTION public.devolver_rollo_por_rollo_id(
  p_rollo_id  uuid,
  p_motivo    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    text;
  v_empresa_id     uuid;
  v_pr_id          uuid;
  v_pedido_id      uuid;
  v_numero_pedido  text;
  v_numero_pieza   text;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin', 'operario') THEN
    RAISE EXCEPTION 'No tenés permiso para devolver rollos.';
  END IF;

  SELECT pr.id, pr.pedido_id, p.numero_pedido, r.numero_pieza
    INTO v_pr_id, v_pedido_id, v_numero_pedido, v_numero_pieza
    FROM pedido_rollos pr
    JOIN pedidos p ON p.id = pr.pedido_id
    JOIN rollos  r ON r.id = pr.rollo_id
   WHERE pr.rollo_id    = p_rollo_id
     AND pr.devuelto_at IS NULL
     AND pr.liberado_at IS NULL
     AND p.estado        = 'confirmada_egreso'
     AND p.empresa_id    = v_empresa_id
     AND r.empresa_id    = v_empresa_id
   LIMIT 1
   FOR UPDATE OF pr, r;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'No se encontró un rollo devolvible para este ID. '
      'Verificá que el pedido esté en estado confirmada_egreso y el rollo no haya sido devuelto antes.';
  END IF;

  UPDATE pedido_rollos
     SET devuelto_at     = now(),
         devuelto_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'devolucion_cliente'),
         liberado_at     = now(),
         liberado_motivo = 'devolucion_cliente'
   WHERE id = v_pr_id;

  UPDATE rollos
     SET estado    = 'en_stock',
         ubicacion = 'Sin ubicar'
   WHERE id = p_rollo_id
     AND estado = 'entregado';

  PERFORM public.notificar_rollo_devuelto(
    v_empresa_id, v_numero_pieza, v_numero_pedido
  );

  PERFORM public.log_movimiento(
    v_empresa_id,
    'pedido_rollo',
    v_pr_id,
    'devolver_rollo',
    jsonb_build_object(
      'pedido_id',    v_pedido_id,
      'rollo_id',     p_rollo_id,
      'numero_pieza', v_numero_pieza,
      'motivo',       NULLIF(trim(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN json_build_object(
    'devuelto',     true,
    'pedido_id',    v_pedido_id,
    'numero_pieza', v_numero_pieza
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.devolver_rollo_por_rollo_id(uuid, text)
  TO authenticated;
