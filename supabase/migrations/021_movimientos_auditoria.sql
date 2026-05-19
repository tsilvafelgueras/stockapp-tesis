-- ============================================================
-- Migración 021 — Historial de movimientos (auditoría inborrable)
--
-- Crea tabla `movimientos` que registra automáticamente toda
-- creación/actualización/eliminación en las entidades clave
-- (rollos, pedidos, ingresos, pedido_rollos, muestras).
--
-- Características:
--   - Solo admin (y super) pueden LEER. Nadie puede INSERT/UPDATE
--     /DELETE directo: los triggers escriben con SECURITY DEFINER.
--   - El detalle de cada movimiento queda en JSONB (cambios viejo→
--     nuevo, número de pieza/pedido, etc.).
--   - Multi-tenant: cada movimiento queda atado a empresa_id.
--
-- Idempotente.
-- ============================================================


-- ── 1. Tabla movimientos ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.movimientos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  entidad     TEXT NOT NULL,
  entidad_id  UUID NOT NULL,
  accion      TEXT NOT NULL,
  usuario_id  UUID REFERENCES auth.users(id),
  detalle     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movimientos_empresa_created_idx
  ON public.movimientos (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS movimientos_empresa_entidad_idx
  ON public.movimientos (empresa_id, entidad, created_at DESC);
CREATE INDEX IF NOT EXISTS movimientos_empresa_usuario_idx
  ON public.movimientos (empresa_id, usuario_id, created_at DESC);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;


-- ── 2. RLS: lectura solo admin/super, sin INSERT/UPDATE/DELETE
-- Los triggers son SECURITY DEFINER y bypassean RLS para escribir.

DROP POLICY IF EXISTS "Admin y super leen movimientos" ON public.movimientos;

CREATE POLICY "Admin y super leen movimientos"
  ON public.movimientos FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      empresa_id = public.current_empresa_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- Sin policy para INSERT/UPDATE/DELETE → bloqueado por RLS para
-- toda llamada que no sea SECURITY DEFINER.


-- ── 3. Helper para auditar ──────────────────────────────────
-- Llama log_movimiento desde cualquier trigger SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.log_movimiento(
  p_empresa_id UUID,
  p_entidad TEXT,
  p_entidad_id UUID,
  p_accion TEXT,
  p_detalle JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_empresa_id IS NULL THEN
    -- Si el trigger se dispara desde un INSERT que aún no tiene
    -- empresa_id (no debería pasar porque set_empresa_id corre
    -- BEFORE), salimos en silencio para no romper la operación.
    RETURN;
  END IF;
  INSERT INTO public.movimientos (
    empresa_id, entidad, entidad_id, accion, usuario_id, detalle
  )
  VALUES (
    p_empresa_id, p_entidad, p_entidad_id, p_accion, auth.uid(), p_detalle
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_movimiento(UUID, TEXT, UUID, TEXT, JSONB)
  TO authenticated;


-- ── 4. Trigger function: rollos ─────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_rollos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambios JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_movimiento(
      NEW.empresa_id,
      'rollo',
      NEW.id,
      'crear',
      jsonb_build_object(
        'numero_pieza', NEW.numero_pieza,
        'estado',       NEW.estado,
        'ubicacion',    NEW.ubicacion,
        'kilos',        NEW.kilos,
        'articulo_id',  NEW.articulo_id,
        'ingreso_id',   NEW.ingreso_id
      )
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_cambios := v_cambios || jsonb_build_object(
        'estado', jsonb_build_array(OLD.estado, NEW.estado)
      );
    END IF;
    IF NEW.ubicacion IS DISTINCT FROM OLD.ubicacion THEN
      v_cambios := v_cambios || jsonb_build_object(
        'ubicacion', jsonb_build_array(OLD.ubicacion, NEW.ubicacion)
      );
    END IF;
    IF NEW.kilos IS DISTINCT FROM OLD.kilos THEN
      v_cambios := v_cambios || jsonb_build_object(
        'kilos', jsonb_build_array(OLD.kilos, NEW.kilos)
      );
    END IF;
    IF NEW.articulo_id IS DISTINCT FROM OLD.articulo_id THEN
      v_cambios := v_cambios || jsonb_build_object(
        'articulo_id', jsonb_build_array(OLD.articulo_id, NEW.articulo_id)
      );
    END IF;
    IF NEW.kilos_propios IS DISTINCT FROM OLD.kilos_propios THEN
      v_cambios := v_cambios || jsonb_build_object(
        'kilos_propios', jsonb_build_array(OLD.kilos_propios, NEW.kilos_propios)
      );
    END IF;
    IF NEW.auditado_at IS DISTINCT FROM OLD.auditado_at
       AND NEW.auditado_at IS NOT NULL THEN
      v_cambios := v_cambios || jsonb_build_object(
        'auditado_at', NEW.auditado_at
      );
    END IF;

    IF v_cambios <> '{}'::JSONB THEN
      PERFORM log_movimiento(
        NEW.empresa_id,
        'rollo',
        NEW.id,
        CASE
          WHEN v_cambios ? 'auditado_at' AND v_cambios - 'auditado_at' = '{}'::JSONB
            THEN 'auditar'
          WHEN v_cambios ? 'estado' THEN 'cambiar_estado'
          ELSE 'actualizar'
        END,
        jsonb_build_object('numero_pieza', NEW.numero_pieza, 'cambios', v_cambios)
      );
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM log_movimiento(
      OLD.empresa_id,
      'rollo',
      OLD.id,
      'eliminar',
      jsonb_build_object('numero_pieza', OLD.numero_pieza, 'estado', OLD.estado)
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_rollos_changes ON public.rollos;
CREATE TRIGGER log_rollos_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.rollos
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_rollos();


-- ── 5. Trigger function: pedidos ────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_pedidos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambios JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_movimiento(
      NEW.empresa_id,
      'pedido',
      NEW.id,
      'crear',
      jsonb_build_object(
        'numero_pedido',         NEW.numero_pedido,
        'cliente',               NEW.cliente,
        'numero_remito_externo', NEW.numero_remito_externo,
        'estado',                NEW.estado
      )
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_cambios := v_cambios || jsonb_build_object(
        'estado', jsonb_build_array(OLD.estado, NEW.estado)
      );
    END IF;
    IF NEW.cliente IS DISTINCT FROM OLD.cliente THEN
      v_cambios := v_cambios || jsonb_build_object(
        'cliente', jsonb_build_array(OLD.cliente, NEW.cliente)
      );
    END IF;
    IF NEW.numero_remito_externo IS DISTINCT FROM OLD.numero_remito_externo THEN
      v_cambios := v_cambios || jsonb_build_object(
        'numero_remito_externo',
        jsonb_build_array(OLD.numero_remito_externo, NEW.numero_remito_externo)
      );
    END IF;

    IF v_cambios <> '{}'::JSONB THEN
      PERFORM log_movimiento(
        NEW.empresa_id,
        'pedido',
        NEW.id,
        CASE WHEN v_cambios ? 'estado' THEN 'cambiar_estado' ELSE 'actualizar' END,
        jsonb_build_object('numero_pedido', NEW.numero_pedido, 'cambios', v_cambios)
      );
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM log_movimiento(
      OLD.empresa_id,
      'pedido',
      OLD.id,
      'eliminar',
      jsonb_build_object('numero_pedido', OLD.numero_pedido, 'cliente', OLD.cliente)
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_pedidos_changes ON public.pedidos;
CREATE TRIGGER log_pedidos_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_pedidos();


-- ── 6. Trigger function: ingresos ───────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_ingresos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambios JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_movimiento(
      NEW.empresa_id,
      'ingreso',
      NEW.id,
      'crear',
      jsonb_build_object(
        'fecha_despacho',         NEW.fecha_despacho,
        'numero_remito',          NEW.numero_remito,
        'estado',                 NEW.estado,
        'origen',                 NEW.origen,
        'tintoreria_id',          NEW.tintoreria_id,
        'articulo_id',            NEW.articulo_id,
        'total_rollos_declarado', NEW.total_rollos_declarado,
        'total_kilos_declarado',  NEW.total_kilos_declarado
      )
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_cambios := v_cambios || jsonb_build_object(
        'estado', jsonb_build_array(OLD.estado, NEW.estado)
      );
    END IF;
    IF NEW.tintoreria_id IS DISTINCT FROM OLD.tintoreria_id THEN
      v_cambios := v_cambios || jsonb_build_object(
        'tintoreria_id', jsonb_build_array(OLD.tintoreria_id, NEW.tintoreria_id)
      );
    END IF;
    IF NEW.articulo_id IS DISTINCT FROM OLD.articulo_id THEN
      v_cambios := v_cambios || jsonb_build_object(
        'articulo_id', jsonb_build_array(OLD.articulo_id, NEW.articulo_id)
      );
    END IF;
    IF NEW.fecha_despacho IS DISTINCT FROM OLD.fecha_despacho THEN
      v_cambios := v_cambios || jsonb_build_object(
        'fecha_despacho', jsonb_build_array(OLD.fecha_despacho, NEW.fecha_despacho)
      );
    END IF;
    IF NEW.numero_remito IS DISTINCT FROM OLD.numero_remito THEN
      v_cambios := v_cambios || jsonb_build_object(
        'numero_remito', jsonb_build_array(OLD.numero_remito, NEW.numero_remito)
      );
    END IF;
    IF NEW.total_rollos_declarado IS DISTINCT FROM OLD.total_rollos_declarado THEN
      v_cambios := v_cambios || jsonb_build_object(
        'total_rollos_declarado',
        jsonb_build_array(OLD.total_rollos_declarado, NEW.total_rollos_declarado)
      );
    END IF;
    IF NEW.total_kilos_declarado IS DISTINCT FROM OLD.total_kilos_declarado THEN
      v_cambios := v_cambios || jsonb_build_object(
        'total_kilos_declarado',
        jsonb_build_array(OLD.total_kilos_declarado, NEW.total_kilos_declarado)
      );
    END IF;

    IF v_cambios <> '{}'::JSONB THEN
      PERFORM log_movimiento(
        NEW.empresa_id,
        'ingreso',
        NEW.id,
        CASE WHEN v_cambios ? 'estado' THEN 'cambiar_estado' ELSE 'actualizar' END,
        jsonb_build_object('numero_remito', NEW.numero_remito, 'cambios', v_cambios)
      );
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM log_movimiento(
      OLD.empresa_id,
      'ingreso',
      OLD.id,
      'eliminar',
      jsonb_build_object('numero_remito', OLD.numero_remito)
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_ingresos_changes ON public.ingresos;
CREATE TRIGGER log_ingresos_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.ingresos
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_ingresos();


-- ── 7. Trigger function: pedido_rollos ──────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_pedido_rollos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_movimiento(
      NEW.empresa_id,
      'pedido_rollo',
      NEW.id,
      'asignar_rollo',
      jsonb_build_object('pedido_id', NEW.pedido_id, 'rollo_id', NEW.rollo_id)
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.pickeado_at IS DISTINCT FROM OLD.pickeado_at
       AND NEW.pickeado_at IS NOT NULL THEN
      PERFORM log_movimiento(
        NEW.empresa_id,
        'pedido_rollo',
        NEW.id,
        'pickear',
        jsonb_build_object(
          'pedido_id', NEW.pedido_id,
          'rollo_id',  NEW.rollo_id
        )
      );
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM log_movimiento(
      OLD.empresa_id,
      'pedido_rollo',
      OLD.id,
      'desasignar_rollo',
      jsonb_build_object('pedido_id', OLD.pedido_id, 'rollo_id', OLD.rollo_id)
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_pedido_rollos_changes ON public.pedido_rollos;
CREATE TRIGGER log_pedido_rollos_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_rollos
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_pedido_rollos();


-- ── 8. Trigger function: muestras ───────────────────────────

CREATE OR REPLACE FUNCTION public.trg_log_muestras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_movimiento(
      NEW.empresa_id,
      'muestra',
      NEW.id,
      'crear',
      jsonb_build_object(
        'rollo_id',          NEW.rollo_id,
        'cliente',           NEW.cliente,
        'kilos_descontados', NEW.kilos_descontados,
        'motivo',            NEW.motivo
      )
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM log_movimiento(
      OLD.empresa_id,
      'muestra',
      OLD.id,
      'eliminar',
      jsonb_build_object('rollo_id', OLD.rollo_id, 'cliente', OLD.cliente)
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_muestras_changes ON public.muestras;
CREATE TRIGGER log_muestras_changes
  AFTER INSERT OR DELETE ON public.muestras
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_muestras();
