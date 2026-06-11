-- El RPC de creacion de pedidos genera numero_pedido como MAX+1 por
-- empresa_id, pero la columna tenia un UNIQUE global (heredado de cuando la
-- tabla se llamaba "ordenes"/"numero_orden"). Eso provoca colisiones
-- ("duplicate key value violates unique constraint") entre pedidos de
-- distintas empresas que generan el mismo numero. Se reemplaza por un
-- UNIQUE compuesto (empresa_id, numero_pedido).

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS ordenes_numero_orden_key;
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_numero_pedido_key;
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_empresa_numero_pedido_key;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_empresa_numero_pedido_key UNIQUE (empresa_id, numero_pedido);
