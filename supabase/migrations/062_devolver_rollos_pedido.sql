-- ============================================================
-- Migración 062 - Devolución parcial de rollos de pedido entregado
--
-- Un cliente puede devolver físicamente algunos rollos después de que
-- el pedido ya fue entregado (estado 'confirmada_egreso').
-- El operario registra la devolución y los rollos vuelven a stock.
--
-- Agrega:
--   - devuelto_at / devuelto_motivo en pedido_rollos
--   - tipo 'rollo_devuelto' en notificaciones (notifica al operario)
--   - RPC devolver_rollos_pedido  → usado desde la página del pedido
--   - RPC devolver_rollo_por_rollo_id → usado desde el dialog de stock
--
-- Idempotente.
-- ============================================================

-- 1) Columnas en pedido_rollos ------------------------------------------------

ALTER TABLE public.pedido_rollos
  ADD COLUMN IF NOT EXISTS devuelto_at     timestamptz,
  ADD COLUMN IF NOT EXISTS devuelto_motivo text;

-- 2) Ampliar check constraint de tipo en notificaciones -----------------------

ALTER TABLE public.notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('stock_minimo', 'rollo_liberado', 'rollo_eliminado', 'rollo_devuelto'));

-- 3) Extender política RLS del operario para incluir rollo_devuelto -----------
--    (necesita ver las notificaciones de devolución para reubicar el rollo)

DROP POLICY IF EXISTS notificaciones_select_operario ON public.notificaciones;
CREATE POLICY notificaciones_select_operario ON public.notificaciones
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND tipo IN ('rollo_liberado', 'rollo_devuelto')
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
    AND tipo IN ('rollo_liberado', 'rollo_devuelto')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'operario'
    )
  );

-- 4) Helper de notificación ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.notificar_rollo_devuelto(
  p_empresa_id     uuid,
  p_numero_pieza   text,
  p_numero_pedido  text
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
    'rollo_devuelto',
    'Rollo devuelto al stock',
    'El rollo ' || COALESCE(p_numero_pieza, '?')
      || ' del pedido ' || COALESCE(p_numero_pedido, '-')
      || ' fue devuelto por el cliente y volvió a stock como "Sin ubicar". Asignale una ubicación.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_rollo_devuelto(uuid, text, text)
  TO authenticated;

-- 5) RPC principal: devolver lista de rollos de un pedido confirmado ----------

CREATE OR REPLACE FUNCTION public.devolver_rollos_pedido(
  p_pedido_id      uuid,
  p_pedido_rollo_ids uuid[],
  p_motivo         text DEFAULT NULL
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
           devuelto_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'devolucion_cliente')
     WHERE id = r_pr.pr_id;

    UPDATE rollos
       SET estado   = 'en_stock',
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

-- 6) Helper para la ruta del operario: devolver un rollo buscando por rollo_id

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
   WHERE pr.rollo_id   = p_rollo_id
     AND pr.devuelto_at IS NULL
     AND pr.liberado_at IS NULL
     AND p.estado       = 'confirmada_egreso'
     AND p.empresa_id   = v_empresa_id
     AND r.empresa_id   = v_empresa_id
   LIMIT 1
   FOR UPDATE OF pr, r;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'No se encontró un rollo devolvible para este ID. '
      'Verificá que el pedido esté en estado confirmada_egreso y el rollo no haya sido devuelto antes.';
  END IF;

  UPDATE pedido_rollos
     SET devuelto_at     = now(),
         devuelto_motivo = COALESCE(NULLIF(trim(p_motivo), ''), 'devolucion_cliente')
   WHERE id = v_pr_id;

  UPDATE rollos
     SET estado   = 'en_stock',
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
    'devuelto',       true,
    'pedido_id',      v_pedido_id,
    'numero_pieza',   v_numero_pieza
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.devolver_rollo_por_rollo_id(uuid, text)
  TO authenticated;
