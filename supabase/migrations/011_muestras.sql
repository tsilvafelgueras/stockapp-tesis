-- ============================================================
-- Migración 011 — Etapa 7A: Muestras
--
-- Tabla `muestras` para registrar entregas pequeñas de tela
-- a clientes (sample/cortes que se descuentan del rollo) sin
-- pasar por el flujo formal de pedidos.
--
-- Cada muestra:
--   - apunta a un rollo
--   - tiene cliente + motivo + kilos_descontados
--   - puede vincularse a un pedido existente (opcional)
--
-- RPC `registrar_muestra` valida que el rollo tenga kilos
-- suficientes y descuenta atómicamente.
--
-- Idempotente.
-- ============================================================


-- ── 1. Tabla muestras ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS muestras (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id             UUID NOT NULL REFERENCES empresas(id),
  rollo_id               UUID NOT NULL REFERENCES rollos(id),
  cliente                TEXT NOT NULL,
  kilos_descontados      NUMERIC(10, 2) NOT NULL CHECK (kilos_descontados > 0),
  motivo                 TEXT,
  vinculado_a_pedido_id  UUID REFERENCES pedidos(id),
  created_by             UUID REFERENCES profiles(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;


-- ── 2. RLS por empresa ──────────────────────────────────────

DROP POLICY IF EXISTS "Autenticados leen muestras de su empresa"  ON muestras;
DROP POLICY IF EXISTS "Operario y admin gestionan muestras"       ON muestras;

CREATE POLICY "Autenticados leen muestras de su empresa"
  ON muestras FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Operario y admin gestionan muestras"
  ON muestras FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operario', 'admin')
  );


-- ── 3. Trigger auto-set de empresa_id ───────────────────────

DROP TRIGGER IF EXISTS set_empresa_muestras ON muestras;
CREATE TRIGGER set_empresa_muestras BEFORE INSERT ON muestras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();


-- ── 4. RPC registrar_muestra ────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_muestra(
  p_rollo_id UUID,
  p_kilos NUMERIC,
  p_cliente TEXT,
  p_motivo TEXT,
  p_pedido_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_empresa_id   UUID;
  v_rollo_kilos  NUMERIC;
  v_rollo_emp    UUID;
  v_rollo_estado TEXT;
  v_muestra_id   UUID;
BEGIN
  IF p_kilos IS NULL OR p_kilos <= 0 THEN
    RAISE EXCEPTION 'Los kilos descontados deben ser mayores a cero.';
  END IF;
  IF p_cliente IS NULL OR length(trim(p_cliente)) = 0 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
  END IF;

  SELECT role, empresa_id INTO v_caller_role, v_empresa_id
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('operario', 'admin') THEN
    RAISE EXCEPTION 'Solo operario o admin pueden registrar muestras.';
  END IF;

  -- Lockear rollo + traer estado
  SELECT kilos, empresa_id, estado
    INTO v_rollo_kilos, v_rollo_emp, v_rollo_estado
    FROM rollos
   WHERE id = p_rollo_id
   FOR UPDATE;

  IF NOT FOUND OR v_rollo_emp <> v_empresa_id THEN
    RAISE EXCEPTION 'Rollo no encontrado.';
  END IF;
  IF v_rollo_estado NOT IN ('en_stock', 'reservado') THEN
    RAISE EXCEPTION 'Solo se pueden tomar muestras de rollos en stock o reservados.';
  END IF;
  IF COALESCE(v_rollo_kilos, 0) - p_kilos < 0 THEN
    RAISE EXCEPTION 'No alcanzan los kilos del rollo (% disponibles, % pedidos).',
      v_rollo_kilos, p_kilos;
  END IF;

  -- Si se vincula a un pedido, validar que sea de la misma empresa
  IF p_pedido_id IS NOT NULL THEN
    PERFORM 1 FROM pedidos
     WHERE id = p_pedido_id AND empresa_id = v_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido vinculado no encontrado.';
    END IF;
  END IF;

  -- Insertar muestra
  INSERT INTO muestras (
    rollo_id, cliente, kilos_descontados, motivo,
    vinculado_a_pedido_id, created_by
  )
  VALUES (
    p_rollo_id,
    trim(p_cliente),
    p_kilos,
    NULLIF(trim(p_motivo), ''),
    p_pedido_id,
    auth.uid()
  )
  RETURNING id INTO v_muestra_id;

  -- Descontar kilos del rollo
  UPDATE rollos
     SET kilos = COALESCE(kilos, 0) - p_kilos
   WHERE id = p_rollo_id;

  RETURN v_muestra_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_muestra(UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;
