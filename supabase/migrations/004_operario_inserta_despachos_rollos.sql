-- ============================================================
-- Migración 004 — Operario puede crear despachos y rollos
--
-- En la migración anterior operario solo tenía UPDATE en despachos
-- y rollos. Pero cuando carga un despacho a mano necesita INSERT.
-- Unificamos las policies a "ALL" para admin + operario.
-- ============================================================

-- Despachos
DROP POLICY IF EXISTS "Admin gestiona despachos"        ON despachos;
DROP POLICY IF EXISTS "Admins gestionan despachos"      ON despachos;
DROP POLICY IF EXISTS "Operario actualiza despachos"    ON despachos;
DROP POLICY IF EXISTS "Depósito actualiza despachos"    ON despachos;
DROP POLICY IF EXISTS "Admin y operario gestionan despachos" ON despachos;

CREATE POLICY "Admin y operario gestionan despachos"
  ON despachos FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario'));

-- Rollos
DROP POLICY IF EXISTS "Admin gestiona rollos"        ON rollos;
DROP POLICY IF EXISTS "Admins gestionan rollos"      ON rollos;
DROP POLICY IF EXISTS "Operario actualiza rollos"    ON rollos;
DROP POLICY IF EXISTS "Depósito actualiza rollos"    ON rollos;
DROP POLICY IF EXISTS "Admin y operario gestionan rollos" ON rollos;

CREATE POLICY "Admin y operario gestionan rollos"
  ON rollos FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operario'));
