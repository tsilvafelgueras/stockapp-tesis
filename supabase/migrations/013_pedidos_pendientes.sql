-- Migración 013: tabla pedidos_pendientes (demandas sin stock asignado)
--
-- A diferencia de `pedidos` (que reservan rollos concretos), un pedido
-- pendiente registra la *intención* de compra de un cliente sin que haya
-- rollos disponibles aún: cliente + artículo + color + metros/kilos estimados.
-- Cuando entra un lote que coincide, la app alerta al equipo de ventas.

CREATE TABLE IF NOT EXISTS public.pedidos_pendientes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID        NOT NULL REFERENCES empresas(id),
  cliente           TEXT        NOT NULL,
  articulo_id       UUID        REFERENCES articulos(id),
  color             TEXT,
  metros_estimados  NUMERIC,
  kilos_estimados   NUMERIC,
  notas             TEXT,
  estado            TEXT        NOT NULL DEFAULT 'activo'
                                CHECK (estado IN ('activo', 'resuelto', 'cancelado')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  created_by        UUID        REFERENCES auth.users(id)
);

ALTER TABLE public.pedidos_pendientes ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados de la empresa pueden leer
CREATE POLICY "Autenticados leen pedidos_pendientes de su empresa"
  ON pedidos_pendientes FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

-- Ventas y admin pueden insertar
CREATE POLICY "Ventas y admin crean pedidos_pendientes"
  ON pedidos_pendientes FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

-- Ventas y admin pueden actualizar (para cambiar estado)
CREATE POLICY "Ventas y admin actualizan pedidos_pendientes"
  ON pedidos_pendientes FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin')
  );

-- Trigger: auto-fill empresa_id (mismo patrón que el resto de tablas)
CREATE TRIGGER set_empresa_id_pedidos_pendientes
  BEFORE INSERT ON pedidos_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
