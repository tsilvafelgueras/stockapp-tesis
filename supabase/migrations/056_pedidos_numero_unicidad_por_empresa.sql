-- La constraint original de numero_pedido era UNIQUE global (sin empresa_id),
-- lo que causa colisiones en entornos multi-tenant: si dos empresas intentan
-- crear su primer pedido, ambas generan "00001" y la segunda falla.
--
-- La constraint correcta es UNIQUE (empresa_id, numero_pedido).

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS ordenes_numero_orden_key;

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_numero_pedido_key;

ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_empresa_numero_pedido_key
    UNIQUE (empresa_id, numero_pedido);
