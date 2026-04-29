-- ============================================================
-- Migración 001 — Refactor para Etapa 2
--
-- Aplica los cambios de modelo descubiertos al leer el documento
-- de tesis original sobre el sistema de Muter Textil:
--
-- 1. Tres roles en vez de dos: operario, ventas, admin.
--    El rol "deposito" se renombra a "operario".
-- 2. Estados de rollo: "despachado" → "entregado", agregar "baja".
-- 3. Modelo de pedidos: drop orden_items + asignaciones, rename
--    ordenes → pedidos, agregar pedido_rollos (m2m simple).
-- 4. Nuevos campos en rollos: foto_url, pantone, datos propios.
--
-- Las tablas orden_items y asignaciones están vacías (Etapa 1 no
-- creó datos en ellas) por lo que el drop es seguro.
--
-- Correr en Supabase → SQL Editor → New query → Run All.
-- ============================================================


-- ── 1. Roles ────────────────────────────────────────────────

-- Renombrar el rol deposito → operario en los perfiles existentes
UPDATE profiles SET role = 'operario' WHERE role = 'deposito';

-- Actualizar el check constraint
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('operario', 'ventas', 'admin'));


-- ── 2. Estados del rollo ────────────────────────────────────

ALTER TABLE rollos DROP CONSTRAINT rollos_estado_check;
ALTER TABLE rollos ADD CONSTRAINT rollos_estado_check
  CHECK (estado IN ('pendiente', 'en_stock', 'reservado', 'entregado', 'baja'));


-- ── 3. Nuevos campos en rollos ──────────────────────────────

ALTER TABLE rollos
  ADD COLUMN IF NOT EXISTS pantone        TEXT,
  ADD COLUMN IF NOT EXISTS foto_url       TEXT,
  ADD COLUMN IF NOT EXISTS kilos_propios  NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS metros_propios NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS ancho_propio   NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS gramaje_propio NUMERIC(10, 2);


-- ── 4. Refactor de pedidos ──────────────────────────────────

-- Drop tablas viejas (vacías) y sus policies
DROP TABLE IF EXISTS asignaciones CASCADE;
DROP TABLE IF EXISTS orden_items  CASCADE;

-- Renombrar ordenes → pedidos
ALTER TABLE ordenes RENAME TO pedidos;
ALTER TABLE pedidos RENAME COLUMN numero_orden TO numero_pedido;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_remito_externo TEXT;

-- Renombrar el constraint de check (PostgreSQL no renombra automáticamente)
ALTER TABLE pedidos DROP CONSTRAINT ordenes_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'en_preparacion', 'lista', 'entregada', 'cancelada'));

-- Refrescar policies de pedidos (las viejas referenciaban "ordenes")
DROP POLICY IF EXISTS "Autenticados leen órdenes"           ON pedidos;
DROP POLICY IF EXISTS "Admins gestionan órdenes"            ON pedidos;
DROP POLICY IF EXISTS "Autenticados pueden leer órdenes"    ON pedidos;
DROP POLICY IF EXISTS "Admins gestionan ordenes"            ON pedidos;

CREATE POLICY "Autenticados leen pedidos"
  ON pedidos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ventas y admin gestionan pedidos"
  ON pedidos FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin'));

CREATE POLICY "Operario actualiza estado de pedidos"
  ON pedidos FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'operario');


-- ── 5. Nueva tabla pedido_rollos ────────────────────────────

CREATE TABLE pedido_rollos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id  UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  rollo_id   UUID NOT NULL REFERENCES rollos(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rollo_id)
);

ALTER TABLE pedido_rollos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen pedido_rollos"
  ON pedido_rollos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ventas y admin gestionan pedido_rollos"
  ON pedido_rollos FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('ventas', 'admin'));


-- ── 6. Refrescar policies que referenciaban 'deposito' ──────

DROP POLICY IF EXISTS "Depósito actualiza despachos" ON despachos;
DROP POLICY IF EXISTS "Depósito actualiza rollos"    ON rollos;

CREATE POLICY "Operario actualiza despachos"
  ON despachos FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'operario');

CREATE POLICY "Operario actualiza rollos"
  ON rollos FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'operario');
