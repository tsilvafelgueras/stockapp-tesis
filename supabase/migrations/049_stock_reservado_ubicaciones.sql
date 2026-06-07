-- ============================================================
-- Migracion 049 - Stock reservado, picking flexible y ubicaciones
--
-- - "Reservado" comercial se calcula desde pedido_partidas.
-- - El rollo fisico pasa a estado reservado solo cuando deposito lo pickea.
-- - Picking permite reemplazar partida si coincide articulo + color.
-- - Ubicaciones pasan a catalogo administrable por empresa.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ubicaciones (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id),
  codigo           text NOT NULL,
  descripcion      text,
  tipo             text NOT NULL DEFAULT 'general'
                   CHECK (tipo IN ('general', 'rack', 'piso', 'preparacion', 'devolucion', 'otro')),
  capacidad_rollos integer CHECK (capacidad_rollos IS NULL OR capacidad_rollos >= 0),
  capacidad_kg     numeric(10, 2) CHECK (capacidad_kg IS NULL OR capacidad_kg >= 0),
  orden            integer NOT NULL DEFAULT 0,
  activa           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS ubicaciones_empresa_activa_idx
  ON public.ubicaciones (empresa_id, activa, orden, codigo);

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen ubicaciones de su empresa"
  ON public.ubicaciones;
CREATE POLICY "Autenticados leen ubicaciones de su empresa"
  ON public.ubicaciones FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins gestionan ubicaciones"
  ON public.ubicaciones;
CREATE POLICY "Admins gestionan ubicaciones"
  ON public.ubicaciones FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP TRIGGER IF EXISTS set_empresa_ubicaciones ON public.ubicaciones;
CREATE TRIGGER set_empresa_ubicaciones
  BEFORE INSERT ON public.ubicaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

WITH racks AS (
  SELECT rack, ord
    FROM unnest(ARRAY['A', 'B', 'C', 'D', 'E', 'F']) WITH ORDINALITY AS r(rack, ord)
),
defaults AS (
  SELECT 'A ordenar'::text AS codigo, 'preparacion'::text AS tipo, 0::integer AS orden
  UNION ALL
  SELECT 'Sin ubicar', 'general', 1
  UNION ALL
  SELECT rack || n::text, 'rack', 10 + ((ord - 1) * 30 + n)
    FROM racks
   CROSS JOIN generate_series(1, 30) AS n
)
INSERT INTO public.ubicaciones (empresa_id, codigo, tipo, orden)
SELECT e.id, d.codigo, d.tipo, d.orden
  FROM public.empresas e
 CROSS JOIN defaults d
ON CONFLICT (empresa_id, codigo) DO NOTHING;

INSERT INTO public.ubicaciones (empresa_id, codigo, tipo, orden, activa)
SELECT DISTINCT r.empresa_id, btrim(r.ubicacion), 'general', 999, true
  FROM public.rollos r
 WHERE r.ubicacion IS NOT NULL
   AND btrim(r.ubicacion) <> ''
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- La unicidad activa debe ignorar filas liberadas y rollo_id NULL.
ALTER TABLE public.pedido_rollos
  DROP CONSTRAINT IF EXISTS pedido_rollos_rollo_id_key;

DROP INDEX IF EXISTS public.pedido_rollos_rollo_id_key;
DROP INDEX IF EXISTS public.pedido_rollos_rollo_id_activo_key;

CREATE UNIQUE INDEX IF NOT EXISTS pedido_rollos_rollo_id_activo_key
  ON public.pedido_rollos (rollo_id)
  WHERE liberado_at IS NULL AND rollo_id IS NOT NULL;


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
  v_rollo_ingreso    uuid;
  v_rollo_ubicacion  text;
  v_rollo_lote       text;
  v_partida_id       uuid;
  v_partida_ingreso  uuid;
  v_partida_lote     text;
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

  SELECT r.id, r.kilos, r.articulo_id, r.color_id, r.ingreso_id,
         r.ubicacion, i.numero_lote
    INTO v_rollo_id, v_rollo_kilos, v_rollo_articulo, v_rollo_color,
         v_rollo_ingreso, v_rollo_ubicacion, v_rollo_lote
    FROM rollos r
    LEFT JOIN ingresos i ON i.id = r.ingreso_id
   WHERE r.empresa_id = v_empresa_id
     AND r.numero_pieza = trim(p_numero_pieza)
     AND r.estado = 'en_stock'
   LIMIT 1
   FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este rollo no esta disponible para picking o no pertenece a esta empresa.';
  END IF;

  SELECT pp.id, pp.ingreso_id, i.numero_lote
    INTO v_partida_id, v_partida_ingreso, v_partida_lote
    FROM pedido_partidas pp
    LEFT JOIN ingresos i ON i.id = pp.ingreso_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS cantidad
        FROM pedido_rollos pr
       WHERE pr.pedido_partida_id = pp.id
         AND pr.liberado_at IS NULL
    ) asignados ON TRUE
   WHERE pp.pedido_id = p_pedido_id
     AND pp.empresa_id = v_empresa_id
     AND pp.articulo_id = v_rollo_articulo
     AND pp.color_id = v_rollo_color
     AND COALESCE(asignados.cantidad, 0) < pp.rollos_solicitados
   ORDER BY
     CASE WHEN pp.ingreso_id = v_rollo_ingreso THEN 0 ELSE 1 END,
     pp.created_at ASC
   LIMIT 1
   FOR UPDATE OF pp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este rollo no coincide con articulo/color pendiente del pedido, o todas las lineas ya estan completas.';
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
    'ubicacion', v_rollo_ubicacion,
    'articulo_id', v_rollo_articulo,
    'color_id', v_rollo_color,
    'ingreso_id', v_rollo_ingreso,
    'pedido_partida_id', v_partida_id,
    'partida_real_lote', v_rollo_lote,
    'partida_solicitada_lote', v_partida_lote,
    'es_sustitucion_partida', v_rollo_ingreso <> v_partida_ingreso,
    'pendientes', v_pendientes,
    'total', v_total,
    'pedido_completo', v_pendientes = 0
  );
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

  SELECT codigo INTO v_ubicacion
    FROM ubicaciones
   WHERE empresa_id = v_empresa_id
     AND codigo = COALESCE(NULLIF(trim(p_ubicacion_reasignacion), ''), 'A ordenar')
     AND activa = true
   LIMIT 1;

  IF v_ubicacion IS NULL THEN
    RAISE EXCEPTION 'La ubicacion de reasignacion no existe o esta inactiva.';
  END IF;

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
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid, text, text, text) TO authenticated;
