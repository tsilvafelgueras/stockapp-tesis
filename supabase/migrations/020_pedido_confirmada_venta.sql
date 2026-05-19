-- ============================================================
-- Migración 020 — Estado "confirmada_venta" en pedidos
--
-- Agrega una instancia explícita post-picking: ventas debe
-- confirmar la venta antes de que admin pueda entregar el pedido.
-- Esto separa "picking terminado" (`lista`) de "venta cerrada"
-- (`confirmada_venta`) y permite revertir si la venta se cae:
--
--   pendiente → en_preparacion → lista → confirmada_venta → entregada
--                                  ↓
--                              cancelada (libera rollos a en_stock)
--
-- Migra el flujo viejo: pedidos en `lista` quedan en `lista`
-- (todavía pueden ser confirmados o caídos por ventas).
-- Pedidos en `entregada` quedan en `entregada` (no cambian — la
-- entrega ya pasó).
--
-- Idempotente.
-- ============================================================


-- ── 1. Agregar columnas de auditoría de confirmación ────────

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS confirmada_venta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmada_venta_por UUID REFERENCES auth.users(id);


-- ── 2. Extender CHECK constraint de estado ──────────────────

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check CHECK (
    estado IN (
      'pendiente',
      'en_preparacion',
      'lista',
      'confirmada_venta',
      'entregada',
      'cancelada'
    )
  );


-- ── 3. RPC confirmar_venta_pedido ───────────────────────────
-- Solo ventas o admin pueden confirmar. El pedido debe estar en
-- estado `lista` (picking terminado). El rollo no cambia de
-- estado (sigue `reservado`); solo cambia el del pedido.

CREATE OR REPLACE FUNCTION public.confirmar_venta_pedido(
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
    RAISE EXCEPTION 'Solo ventas o admin pueden confirmar ventas.';
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
      'Solo se puede confirmar la venta de un pedido en estado lista (estado actual: %).',
      v_estado;
  END IF;

  UPDATE pedidos
     SET estado = 'confirmada_venta',
         confirmada_venta_at = NOW(),
         confirmada_venta_por = auth.uid()
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_venta_pedido(UUID) TO authenticated;


-- ── 4. RPC entregar_pedido: ahora requiere confirmada_venta ─

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
  IF v_estado <> 'confirmada_venta' THEN
    RAISE EXCEPTION
      'Solo se puede entregar un pedido con venta ya confirmada (estado actual: %). Ventas debe confirmar primero.',
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


-- ── 5. RPC cancelar_pedido: aceptar también confirmada_venta ─

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
  IF v_estado NOT IN ('pendiente', 'en_preparacion', 'lista', 'confirmada_venta') THEN
    RAISE EXCEPTION
      'No se puede cancelar un pedido en estado %.',
      v_estado;
  END IF;

  UPDATE rollos
     SET estado = 'en_stock'
   WHERE id IN (
     SELECT rollo_id FROM pedido_rollos WHERE pedido_id = p_pedido_id
   );

  UPDATE pedidos SET estado = 'cancelada' WHERE id = p_pedido_id;
END;
$$;
