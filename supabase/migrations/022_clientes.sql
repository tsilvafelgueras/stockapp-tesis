-- ============================================================
-- Migración 022 — Módulo de clientes
--
-- Crea tabla `clientes` (alta, contacto, dirección, etc.) y
-- agrega `pedidos.cliente_id` UUID NULLABLE referenciando esa
-- tabla. Los pedidos viejos (que solo tenían texto en `cliente`)
-- ya fueron borrados en la 018, así que los pedidos nuevos van
-- a requerir cliente_id desde la UI. Mantenemos `pedidos.cliente`
-- TEXT como columna denormalizada para que las queries antiguas
-- y los reportes sigan funcionando sin join obligatorio.
--
-- Reescribe `crear_pedido` para que tome el cliente_id; el
-- nombre del cliente se autocompleta desde la tabla `clientes`.
--
-- Idempotente.
-- ============================================================


-- ── 1. Tabla clientes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  email       TEXT,
  telefono    TEXT,
  direccion   TEXT,
  notas       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nombre único por empresa
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_empresa_nombre_key;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_empresa_nombre_key UNIQUE (empresa_id, nombre);

CREATE INDEX IF NOT EXISTS clientes_empresa_idx
  ON public.clientes (empresa_id);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen clientes de su empresa" ON public.clientes;
CREATE POLICY "Autenticados leen clientes de su empresa"
  ON public.clientes FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Ventas y admin gestionan clientes" ON public.clientes;
CREATE POLICY "Ventas y admin gestionan clientes"
  ON public.clientes FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

DROP TRIGGER IF EXISTS set_empresa_clientes ON public.clientes;
CREATE TRIGGER set_empresa_clientes BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── 2. pedidos.cliente_id ───────────────────────────────────

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS pedidos_cliente_id_idx
  ON public.pedidos (empresa_id, cliente_id);


-- ── 3. RPC crear_pedido — ahora requiere cliente_id ─────────
-- Reemplaza la firma anterior (TEXT, TEXT, UUID[]) por
-- (UUID, TEXT, UUID[]). Drop explícito porque CREATE OR REPLACE
-- no acepta cambio de firma.

DROP FUNCTION IF EXISTS public.crear_pedido(TEXT, TEXT, UUID[]);

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_cliente_id UUID,
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

  -- Cliente debe ser de la misma empresa y estar activo
  SELECT nombre, empresa_id INTO v_cliente_nombre, v_cliente_empresa
    FROM clientes WHERE id = p_cliente_id AND activo = TRUE;
  IF v_cliente_nombre IS NULL OR v_cliente_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Cliente no encontrado o inactivo.';
  END IF;

  -- Serializar la generación de numero_pedido por empresa
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

  -- INSERT pedido (cliente texto denormalizado desde clientes.nombre)
  INSERT INTO pedidos (
    numero_pedido,
    cliente,
    cliente_id,
    numero_remito_externo,
    estado,
    created_by
  )
  VALUES (
    v_numero,
    v_cliente_nombre,
    p_cliente_id,
    NULLIF(trim(p_numero_remito_externo), ''),
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

GRANT EXECUTE ON FUNCTION public.crear_pedido(UUID, TEXT, UUID[]) TO authenticated;
