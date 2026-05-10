-- ============================================================
-- Migración 009 — RPC de pedidos (crear / cancelar / entregar)
--
-- Encapsula las operaciones de pedidos en funciones de Postgres
-- para garantizar atomicidad y evitar race conditions:
--
--   1. crear_pedido(cliente, remito_externo, rollo_ids[])
--      → INSERT pedido + INSERT pedido_rollos + UPDATE rollos
--        a `reservado`, todo en una transacción. Lockea los
--        rollos con FOR UPDATE para evitar que dos ventas
--        reserven los mismos rollos en simultáneo.
--
--   2. cancelar_pedido(pedido_id)
--      → libera rollos a `en_stock` y marca pedido `cancelada`.
--        Solo si pedido en pendiente/en_preparacion/lista.
--
--   3. entregar_pedido(pedido_id)
--      → rollos a `entregado` y pedido a `entregada`.
--        Solo si pedido en `lista`.
--
-- Las funciones son SECURITY DEFINER porque las RLS de `rollos`
-- restringen UPDATE a operario+admin (etapa 5). Para que ventas
-- pueda crear pedidos y cancelar liberando rollos, la función
-- corre con privilegios elevados pero valida manualmente:
--   - Que el caller sea `ventas` o `admin` (o `admin` en
--     entregar_pedido).
--   - Que los rollos pertenezcan a la empresa del caller.
--   - Que los rollos estén en el estado correcto.
--
-- Además agrega `pedido_rollos.pickeado_at` para tracking de
-- picking (Etapa 6B).
--
-- Idempotente.
-- ============================================================


-- ── 1. Columna `pickeado_at` en pedido_rollos ───────────────
-- Marca cuándo el operario escaneó/confirmó cada rollo durante
-- el picking. NULL = no pickeado todavía.
ALTER TABLE pedido_rollos
  ADD COLUMN IF NOT EXISTS pickeado_at TIMESTAMPTZ NULL;


-- ── 2. crear_pedido() ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_cliente TEXT,
  p_numero_remito_externo TEXT,
  p_rollo_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_empresa_id   UUID;
  v_pedido_id    UUID;
  v_numero       TEXT;
  v_invalidos    INTEGER;
  v_total        INTEGER;
BEGIN
  -- Validaciones de input
  IF p_cliente IS NULL OR length(trim(p_cliente)) = 0 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
  END IF;
  IF p_rollo_ids IS NULL OR array_length(p_rollo_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Tenés que seleccionar al menos un rollo.';
  END IF;

  -- Caller debe ser ventas o admin
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden crear pedidos.';
  END IF;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la empresa del usuario.';
  END IF;

  -- Serializar la generación de numero_pedido por empresa para
  -- evitar duplicados si dos ventas crean pedidos en simultáneo.
  PERFORM pg_advisory_xact_lock(
    hashtext('pedido_numero_' || v_empresa_id::TEXT)
  );

  -- Lockear los rollos involucrados. FOR UPDATE bloquea filas
  -- hasta el COMMIT — si otro pedido los está tomando al mismo
  -- tiempo, el segundo espera y después ve el estado actualizado.
  PERFORM 1
    FROM rollos
   WHERE id = ANY(p_rollo_ids)
   FOR UPDATE;

  -- Validar: todos los rollos deben (a) existir en mi empresa y
  -- (b) estar en estado en_stock.
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

  -- Generar numero_pedido nuevo (MAX por empresa + 1, formato
  -- '00001'). regexp_replace saca prefijos no numéricos por si
  -- algún número viejo viniera con letras.
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

  -- INSERT pedido. El trigger set_empresa_id rellena empresa_id.
  INSERT INTO pedidos (
    numero_pedido,
    cliente,
    numero_remito_externo,
    estado,
    created_by
  )
  VALUES (
    v_numero,
    trim(p_cliente),
    NULLIF(trim(p_numero_remito_externo), ''),
    'pendiente',
    auth.uid()
  )
  RETURNING id INTO v_pedido_id;

  -- INSERT batch en pedido_rollos
  INSERT INTO pedido_rollos (pedido_id, rollo_id)
  SELECT v_pedido_id, rid FROM unnest(p_rollo_ids) AS rid;

  -- UPDATE batch rollos a reservado
  UPDATE rollos
     SET estado = 'reservado'
   WHERE id = ANY(p_rollo_ids);

  RETURN v_pedido_id;
END;
$$;


-- ── 3. cancelar_pedido() ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_pedido(
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
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden cancelar pedidos.';
  END IF;

  -- Lockear y traer estado del pedido (con check de empresa)
  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_emp <> v_empresa_id THEN
    -- No filtrar mensaje para no leakear info de otras empresas
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado NOT IN ('pendiente', 'en_preparacion', 'lista') THEN
    RAISE EXCEPTION
      'No se puede cancelar un pedido en estado %. Solo pendiente, en preparación o lista pueden cancelarse.',
      v_estado;
  END IF;

  -- Liberar rollos: vuelven a en_stock independientemente de si
  -- ya estaban pickeados.
  UPDATE rollos
     SET estado = 'en_stock'
   WHERE id IN (
     SELECT rollo_id FROM pedido_rollos WHERE pedido_id = p_pedido_id
   );

  UPDATE pedidos SET estado = 'cancelada' WHERE id = p_pedido_id;
END;
$$;


-- ── 4. entregar_pedido() ────────────────────────────────────
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
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  -- Solo admin marca como entregada (per spec: ventas no despacha)
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede marcar pedidos como entregados.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado <> 'lista' THEN
    RAISE EXCEPTION
      'Solo se puede entregar un pedido en estado lista (estado actual: %).',
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


-- ── 5. Permisos ─────────────────────────────────────────────
-- authenticated incluye a operario, ventas, admin y super.
-- Las propias funciones bloquean a los roles que no corresponden
-- (super queda fuera porque no tiene empresa_id; operario porque
--  los chequeos de role no lo incluyen).
GRANT EXECUTE ON FUNCTION public.crear_pedido(TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregar_pedido(UUID) TO authenticated;
