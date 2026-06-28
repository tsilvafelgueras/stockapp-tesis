-- ============================================================
-- Migración 061 - Notificación al admin cuando se elimina un rollo
--
-- Agrega tipo 'rollo_eliminado' al check constraint de notificaciones
-- y crea la función helper que la server action llama vía RPC.
-- Idempotente.
-- ============================================================

-- 1) Ampliar check constraint de tipo
ALTER TABLE public.notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('stock_minimo', 'rollo_liberado', 'rollo_eliminado'));

-- 2) Función helper SECURITY DEFINER para que la server action pueda
--    insertar la notificación aunque el RLS no tenga policy de INSERT
--    expuesta para usuarios autenticados comunes.

CREATE OR REPLACE FUNCTION public.notificar_rollo_eliminado(
  p_empresa_id     uuid,
  p_numero_pieza   text,
  p_articulo       text,
  p_color          text,
  p_usuario_nombre text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificaciones (empresa_id, tipo, titulo, mensaje)
  VALUES (
    p_empresa_id,
    'rollo_eliminado',
    'Rollo eliminado del inventario',
    'El rollo ' || COALESCE(p_numero_pieza, '?')
      || CASE
           WHEN p_articulo IS NOT NULL OR p_color IS NOT NULL
           THEN ' (' || ARRAY_TO_STRING(ARRAY[p_articulo, p_color], ' — ') || ')'
           ELSE ''
         END
      || ' fue eliminado definitivamente por ' || COALESCE(p_usuario_nombre, 'un usuario') || '.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_rollo_eliminado(uuid, text, text, text, text)
  TO authenticated;
