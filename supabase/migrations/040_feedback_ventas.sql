-- ============================================================
-- Migracion 040 - Feedback perfil ventas
--
-- Campos comerciales de clientes, demandas tipificadas con prioridad,
-- fecha comprometida de pedidos, salida con remito/comentario
-- y caida con motivo + liberacion real de rollos.
--
-- Idempotente.
-- ============================================================


-- -- 1. Clientes ------------------------------------------------

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cuit_cuil TEXT,
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT,
  ADD COLUMN IF NOT EXISTS categoria_precio TEXT,
  ADD COLUMN IF NOT EXISTS estado_cliente TEXT,
  ADD COLUMN IF NOT EXISTS vendedor_asignado TEXT;

UPDATE public.clientes
   SET estado_cliente = CASE WHEN activo THEN 'activo' ELSE 'inactivo' END
 WHERE estado_cliente IS NULL;

ALTER TABLE public.clientes
  ALTER COLUMN estado_cliente SET DEFAULT 'activo',
  ALTER COLUMN estado_cliente SET NOT NULL;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_estado_cliente_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_estado_cliente_check
  CHECK (estado_cliente IN ('activo', 'inactivo', 'potencial'));

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_condicion_pago_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_condicion_pago_check
  CHECK (
    condicion_pago IS NULL
    OR condicion_pago IN (
      'contado',
      'cuenta_corriente',
      '30_dias',
      '60_dias',
      '90_dias'
    )
  );

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_categoria_precio_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_categoria_precio_check
  CHECK (
    categoria_precio IS NULL
    OR categoria_precio IN ('minorista', 'mayorista', 'precio_especial')
  );

CREATE INDEX IF NOT EXISTS clientes_empresa_estado_idx
  ON public.clientes (empresa_id, estado_cliente);


-- -- 2. Demandas ------------------------------------------------

ALTER TABLE public.pedidos_pendientes
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id),
  ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.colores(id),
  ADD COLUMN IF NOT EXISTS tipo_demanda TEXT,
  ADD COLUMN IF NOT EXISTS prioridad TEXT,
  ADD COLUMN IF NOT EXISTS fecha_requerida DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos_pendientes'
       AND column_name = 'urgencia'
  ) THEN
    EXECUTE $sql$
      UPDATE public.pedidos_pendientes
         SET prioridad = CASE
           WHEN urgencia = 'urgente' THEN 'critica'
           WHEN urgencia = 'fecha_especifica' THEN 'programada'
           WHEN urgencia = 'sin_apuro' THEN 'flexible'
           ELSE COALESCE(prioridad, 'flexible')
         END
       WHERE prioridad IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedidos_pendientes'
       AND column_name = 'fecha_limite'
  ) THEN
    EXECUTE $sql$
      UPDATE public.pedidos_pendientes
         SET fecha_requerida = fecha_limite
       WHERE fecha_requerida IS NULL
         AND fecha_limite IS NOT NULL
    $sql$;
  END IF;
END $$;

UPDATE public.pedidos_pendientes pp
   SET tipo_demanda = COALESCE(tipo_demanda, 'demanda_sin_stock'),
       prioridad = COALESCE(prioridad, 'flexible')
 WHERE tipo_demanda IS NULL
    OR prioridad IS NULL;

UPDATE public.pedidos_pendientes
   SET prioridad = 'flexible'
 WHERE prioridad NOT IN ('critica', 'alta', 'programada', 'flexible');

UPDATE public.pedidos_pendientes pp
   SET cliente_id = c.id
  FROM public.clientes c
 WHERE pp.cliente_id IS NULL
   AND c.empresa_id = pp.empresa_id
   AND lower(trim(c.nombre)) = lower(trim(pp.cliente));

UPDATE public.pedidos_pendientes pp
   SET color_id = c.id
  FROM public.colores c
 WHERE pp.color_id IS NULL
   AND pp.color IS NOT NULL
   AND c.empresa_id = pp.empresa_id
   AND lower(trim(c.nombre)) = lower(trim(pp.color));

ALTER TABLE public.pedidos_pendientes
  ALTER COLUMN tipo_demanda SET DEFAULT 'demanda_sin_stock',
  ALTER COLUMN prioridad SET DEFAULT 'flexible',
  ALTER COLUMN tipo_demanda SET NOT NULL,
  ALTER COLUMN prioridad SET NOT NULL;

ALTER TABLE public.pedidos_pendientes
  DROP CONSTRAINT IF EXISTS pedidos_pendientes_tipo_demanda_check;
ALTER TABLE public.pedidos_pendientes
  ADD CONSTRAINT pedidos_pendientes_tipo_demanda_check
  CHECK (tipo_demanda IN ('pedido_a_producir', 'demanda_sin_stock'));

ALTER TABLE public.pedidos_pendientes
  DROP CONSTRAINT IF EXISTS pedidos_pendientes_urgencia_check;
ALTER TABLE public.pedidos_pendientes
  DROP CONSTRAINT IF EXISTS pedidos_pendientes_prioridad_check;
ALTER TABLE public.pedidos_pendientes
  ADD CONSTRAINT pedidos_pendientes_prioridad_check
  CHECK (prioridad IN ('critica', 'alta', 'programada', 'flexible'));

CREATE INDEX IF NOT EXISTS pedidos_pendientes_cliente_idx
  ON public.pedidos_pendientes (empresa_id, cliente_id);

CREATE INDEX IF NOT EXISTS pedidos_pendientes_articulo_color_idx
  ON public.pedidos_pendientes (empresa_id, articulo_id, color_id, estado);

DROP INDEX IF EXISTS public.pedidos_pendientes_fecha_limite_idx;

CREATE INDEX IF NOT EXISTS pedidos_pendientes_fecha_requerida_idx
  ON public.pedidos_pendientes (empresa_id, fecha_requerida)
  WHERE estado = 'activo';


-- -- 3. Pedidos -------------------------------------------------

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fecha_entrega_comprometida DATE,
  ADD COLUMN IF NOT EXISTS numero_remito_salida TEXT,
  ADD COLUMN IF NOT EXISTS salida_comentario TEXT,
  ADD COLUMN IF NOT EXISTS caida_motivo TEXT,
  ADD COLUMN IF NOT EXISTS caida_comentario TEXT,
  ADD COLUMN IF NOT EXISTS caida_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS caida_por UUID REFERENCES auth.users(id);

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_caida_motivo_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_caida_motivo_check
  CHECK (
    caida_motivo IS NULL
    OR caida_motivo IN (
      'cliente_cancelo',
      'precio',
      'otro_proveedor',
      'sin_respuesta',
      'otro'
    )
  );

CREATE INDEX IF NOT EXISTS pedidos_fecha_entrega_comprometida_idx
  ON public.pedidos (empresa_id, fecha_entrega_comprometida, estado);


-- -- 4. Pedido rollos liberados --------------------------------
-- La UNIQUE global vieja impedia volver a asignar un rollo de un
-- pedido cancelado. La reemplazamos por una unique parcial sobre
-- asignaciones activas.

ALTER TABLE public.pedido_rollos
  ADD COLUMN IF NOT EXISTS liberado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS liberado_motivo TEXT;

ALTER TABLE public.pedido_rollos
  DROP CONSTRAINT IF EXISTS pedido_rollos_rollo_id_key;
DROP INDEX IF EXISTS public.pedido_rollos_rollo_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pedido_rollos_rollo_id_activo_key
  ON public.pedido_rollos (rollo_id)
  WHERE liberado_at IS NULL;


-- -- 5. RPC crear_pedido ---------------------------------------

DROP FUNCTION IF EXISTS public.crear_pedido(UUID, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.crear_pedido(UUID, TEXT, UUID[], DATE);

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_cliente_id UUID,
  p_numero_remito_externo TEXT,
  p_rollo_ids UUID[],
  p_fecha_entrega_comprometida DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    TEXT;
  v_empresa_id     UUID;
  v_pedido_id      UUID;
  v_numero         TEXT;
  v_invalidos      INTEGER;
  v_total          INTEGER;
  v_cliente_nombre TEXT;
  v_cliente_empresa UUID;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que elegir un cliente del catálogo.';
  END IF;
  IF p_rollo_ids IS NULL OR array_length(p_rollo_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Tenés que seleccionar al menos un rollo.';
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

  PERFORM pg_advisory_xact_lock(
    hashtext('pedido_numero_' || v_empresa_id::TEXT)
  );

  PERFORM 1 FROM rollos WHERE id = ANY(p_rollo_ids) FOR UPDATE;

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

  INSERT INTO pedido_rollos (pedido_id, rollo_id)
  SELECT v_pedido_id, rid FROM unnest(p_rollo_ids) AS rid;

  UPDATE rollos
     SET estado = 'reservado'
   WHERE id = ANY(p_rollo_ids);

  RETURN v_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido(UUID, TEXT, UUID[], DATE)
  TO authenticated;


-- -- 6. RPC confirmar salida -----------------------------------

DROP FUNCTION IF EXISTS public.confirmar_egreso_pedido(UUID);
DROP FUNCTION IF EXISTS public.confirmar_egreso_pedido(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirmar_egreso_pedido(
  p_pedido_id UUID,
  p_comentario TEXT DEFAULT NULL,
  p_numero_remito_salida TEXT DEFAULT NULL
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
    RAISE EXCEPTION 'Solo ventas o admin pueden confirmar salidas.';
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND OR v_pedido_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF v_estado <> 'lista' THEN
    RAISE EXCEPTION
      'Solo se puede confirmar la salida de un pedido en estado lista (estado actual: %).',
      v_estado;
  END IF;

  UPDATE pedidos
     SET estado = 'confirmada_egreso',
         confirmada_egreso_at = NOW(),
         confirmada_egreso_por = auth.uid(),
         salida_comentario = NULLIF(trim(p_comentario), ''),
         numero_remito_salida = NULLIF(trim(p_numero_remito_salida), '')
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_egreso_pedido(UUID, TEXT, TEXT)
  TO authenticated;


-- -- 7. RPC cancelar / caer pedido ------------------------------

DROP FUNCTION IF EXISTS public.cancelar_pedido(UUID);
DROP FUNCTION IF EXISTS public.cancelar_pedido(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id UUID,
  p_motivo_caida TEXT DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL,
  p_ubicacion_reasignacion TEXT DEFAULT 'A ordenar'
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
  v_ubicacion   TEXT;
BEGIN
  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles
   WHERE id = auth.uid();

  IF v_caller_role NOT IN ('ventas', 'admin') THEN
    RAISE EXCEPTION 'Solo ventas o admin pueden cancelar pedidos.';
  END IF;

  IF p_motivo_caida IS NOT NULL
     AND trim(p_motivo_caida) <> ''
     AND p_motivo_caida NOT IN (
       'cliente_cancelo',
       'precio',
       'otro_proveedor',
       'sin_respuesta',
       'otro'
     ) THEN
    RAISE EXCEPTION 'Motivo de caida invalido: %.', p_motivo_caida;
  END IF;

  SELECT estado, empresa_id INTO v_estado, v_pedido_emp
    FROM pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

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
   );

  UPDATE pedido_rollos
     SET liberado_at = NOW(),
         liberado_motivo = 'pedido_cancelado'
   WHERE pedido_id = p_pedido_id
     AND liberado_at IS NULL;

  UPDATE pedidos
     SET estado = 'cancelada',
         caida_motivo = NULLIF(trim(p_motivo_caida), ''),
         caida_comentario = NULLIF(trim(p_comentario), ''),
         caida_at = NOW(),
         caida_por = auth.uid()
   WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_pedido(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
