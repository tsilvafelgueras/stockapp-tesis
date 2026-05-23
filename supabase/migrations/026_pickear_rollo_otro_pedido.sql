-- ============================================================
-- Migración 026 — Detectar QR duplicado en otro pedido activo
--
-- Recrea pickear_rollo() agregando un chequeo previo al
-- "no pertenece a este pedido": si el rollo (por numero_pieza)
-- está asignado a OTRO pedido activo (pendiente, en_preparacion
-- o lista) dentro de la misma empresa, lanza una excepción
-- específica con el número del pedido conflictivo para que el
-- operario tenga un mensaje claro en lugar del genérico
-- "no pertenece a este pedido".
--
-- El resto del comportamiento (validación de mismo pedido,
-- transición de estados, retorno JSON) queda igual que en 010.
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
  v_otro_numero   TEXT;
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
    -- ¿Está el rollo asignado a OTRO pedido activo?
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
