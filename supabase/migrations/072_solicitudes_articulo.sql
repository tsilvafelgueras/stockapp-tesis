-- Artículos provisionales: los rollos pueden guardarse mientras el admin aprueba.
BEGIN;

CREATE TABLE public.solicitudes_articulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  articulo_id uuid NOT NULL UNIQUE REFERENCES public.articulos(id),
  nombre_solicitado text NOT NULL,
  solicitado_por uuid NOT NULL REFERENCES auth.users(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada')),
  resuelta_por uuid REFERENCES auth.users(id),
  resuelta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX solicitudes_articulo_empresa_estado_idx
  ON public.solicitudes_articulo (empresa_id, estado, created_at);
ALTER TABLE public.solicitudes_articulo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa lee solicitudes de articulo"
  ON public.solicitudes_articulo FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
-- Las escrituras se realizan exclusivamente por RPC con validación de rol/empresa.
REVOKE ALL ON public.solicitudes_articulo FROM anon, authenticated;
GRANT SELECT ON public.solicitudes_articulo TO authenticated;

-- También asocia los colores que se creen durante la espera de aprobación.
CREATE OR REPLACE FUNCTION public.propagate_new_color_to_articulos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.articulo_colores (empresa_id, articulo_id, color_id)
    SELECT a.empresa_id, a.id, NEW.id FROM public.articulos a
    WHERE a.empresa_id = NEW.empresa_id AND (a.activo OR EXISTS (
      SELECT 1 FROM public.solicitudes_articulo s WHERE s.articulo_id = a.id AND s.estado = 'pendiente'
    )) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('stock_minimo', 'rollo_liberado', 'rollo_eliminado', 'rollo_devuelto', 'solicitud_articulo'));

CREATE FUNCTION public.solicitar_articulo(p_nombre text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa uuid;
  v_role text;
  v_nombre text := trim(regexp_replace(p_nombre, '\s+', ' ', 'g'));
  v_articulo public.articulos%ROWTYPE;
  v_pendiente boolean;
BEGIN
  SELECT empresa_id, role INTO v_empresa, v_role FROM public.profiles WHERE id = auth.uid();
  IF v_empresa IS NULL OR v_role NOT IN ('admin', 'operario') THEN
    RAISE EXCEPTION 'No tenés permiso para solicitar artículos.';
  END IF;
  IF v_nombre IS NULL OR length(v_nombre) < 1 OR length(v_nombre) > 150 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 1 y 150 caracteres.';
  END IF;
  -- Serializa solicitudes equivalentes, incluidas diferencias de espacios/casing.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text || lower(v_nombre), 0));
  SELECT * INTO v_articulo FROM public.articulos
    WHERE empresa_id = v_empresa
      AND lower(trim(regexp_replace(nombre, '\s+', ' ', 'g'))) = lower(v_nombre)
    ORDER BY activo DESC, created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    SELECT EXISTS(SELECT 1 FROM public.solicitudes_articulo
      WHERE articulo_id = v_articulo.id AND estado = 'pendiente') INTO v_pendiente;
    IF NOT v_articulo.activo AND NOT v_pendiente THEN
      RAISE EXCEPTION 'Ese artículo está dado de baja. Pedile al administrador que lo revise.';
    END IF;
    RETURN jsonb_build_object('id', v_articulo.id, 'nombre', v_articulo.nombre, 'pendiente', v_pendiente);
  END IF;

  INSERT INTO public.articulos (empresa_id, nombre, activo)
    VALUES (v_empresa, v_nombre, false) RETURNING * INTO v_articulo;
  -- El trigger 051 asocia los colores existentes incluso al artículo provisional.
  INSERT INTO public.solicitudes_articulo (empresa_id, articulo_id, nombre_solicitado, solicitado_por)
    VALUES (v_empresa, v_articulo.id, v_nombre, auth.uid());
  INSERT INTO public.notificaciones (empresa_id, tipo, titulo, mensaje, articulo_id)
    VALUES (v_empresa, 'solicitud_articulo', 'Artículo pendiente de aprobación',
      'Se solicitó crear "' || v_nombre || '" desde un ingreso. Revisá la solicitud en Artículos.', v_articulo.id);
  RETURN jsonb_build_object('id', v_articulo.id, 'nombre', v_nombre, 'pendiente', true);
END;
$$;

CREATE FUNCTION public.aprobar_solicitud_articulo(p_solicitud_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa uuid;
  v_role text;
  v_sol public.solicitudes_articulo%ROWTYPE;
BEGIN
  SELECT empresa_id, role INTO v_empresa, v_role FROM public.profiles WHERE id = auth.uid();
  IF v_empresa IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede aprobar artículos.';
  END IF;
  SELECT * INTO v_sol FROM public.solicitudes_articulo
    WHERE id = p_solicitud_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  IF v_sol.estado = 'aprobada' THEN RETURN v_sol.articulo_id; END IF;
  UPDATE public.solicitudes_articulo SET estado = 'aprobada', resuelta_por = auth.uid(), resuelta_at = now()
    WHERE id = v_sol.id;
  UPDATE public.articulos SET activo = true WHERE id = v_sol.articulo_id AND empresa_id = v_empresa;
  -- Incluye los colores creados mientras el artículo esperaba aprobación.
  INSERT INTO public.articulo_colores (empresa_id, articulo_id, color_id)
    SELECT v_empresa, v_sol.articulo_id, id FROM public.colores WHERE empresa_id = v_empresa AND activo
    ON CONFLICT DO NOTHING;
  UPDATE public.notificaciones SET resuelta_at = now(), leida_at = COALESCE(leida_at, now())
    WHERE empresa_id = v_empresa AND articulo_id = v_sol.articulo_id AND tipo = 'solicitud_articulo' AND resuelta_at IS NULL;
  RETURN v_sol.articulo_id;
END;
$$;

-- Evita saltarse la aprobación activando el artículo desde una edición genérica.
CREATE FUNCTION public.proteger_articulo_pendiente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.activo AND EXISTS (SELECT 1 FROM public.solicitudes_articulo WHERE articulo_id = NEW.id AND estado = 'pendiente') THEN
    RAISE EXCEPTION 'Aprobá primero la solicitud de creación del artículo.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_articulo_pendiente BEFORE UPDATE OF activo ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_articulo_pendiente();

REVOKE ALL ON FUNCTION public.solicitar_articulo(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aprobar_solicitud_articulo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proteger_articulo_pendiente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_articulo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_articulo(uuid) TO authenticated;
COMMIT;
