-- ============================================================
-- Migración 010 — RPC de picking
--
-- pickear_rollo(p_pedido_id, p_numero_pieza)
--   → marca pedido_rollos.pickeado_at, valida que el rollo
--     pertenezca al pedido y no haya sido pickeado antes.
--   → si era el primer pickeo, transiciona el pedido de
--     'pendiente' a 'en_preparacion'.
--   → si fue el último, transiciona a 'lista'.
--   → devuelve JSON con info de progreso para el cliente.
--
-- SECURITY DEFINER porque ventas/operario tienen permisos
-- distintos sobre pedidos y pedido_rollos. La función valida
-- manualmente: rol operario o admin, mismo empresa_id, estado
-- del pedido válido.
--
-- Idempotente.
-- ============================================================

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
BEGIN
  IF p_numero_pieza IS NULL OR length(trim(p_numero_pieza)) = 0 THEN
    RAISE EXCEPTION 'Falta el número de pieza.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo operario o admin pueden hacer picking.';
  END IF;

  -- Lockear pedido + traer estado
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

  -- Buscar la fila pedido_rollos por numero_pieza dentro de este pedido
  SELECT pr.id, pr.rollo_id, pr.pickeado_at
    INTO v_pr_id, v_rollo_id, v_pickeado_at
    FROM pedido_rollos pr
    JOIN rollos r ON r.id = pr.rollo_id
   WHERE pr.pedido_id = p_pedido_id
     AND r.numero_pieza = trim(p_numero_pieza);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este rollo no pertenece a este pedido.';
  END IF;
  IF v_pickeado_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este rollo ya fue pickeado.';
  END IF;

  -- Marcar pickeado
  UPDATE pedido_rollos SET pickeado_at = NOW() WHERE id = v_pr_id;

  -- Transicionar estado del pedido si corresponde
  IF v_pedido_estado = 'pendiente' THEN
    UPDATE pedidos SET estado = 'en_preparacion' WHERE id = p_pedido_id;
  END IF;

  -- Contar pendientes restantes
  SELECT COUNT(*) FILTER (WHERE pickeado_at IS NULL),
         COUNT(*)
    INTO v_pendientes, v_total
    FROM pedido_rollos
   WHERE pedido_id = p_pedido_id;

  -- Si no quedan pendientes → cerrar a 'lista'
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
